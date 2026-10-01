require('dotenv').config();
const express = require('express'), cors = require('cors'), bcrypt = require('bcryptjs'), multer = require('multer');
const crypto = require('crypto'), path = require('path'), fs = require('fs');
const db = require('./db'), { sign, auth, allow, log } = require('./auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads'); // NOT served statically
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 10 * 1024 * 1024 } });
const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN })); app.use(express.json({ limit: '1mb' }));
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ error: 'Server error' }); });
const req_ = (res, ok, msg) => ok || (res.status(400).json({ error: msg }), false);
const AG = [auth, allow('agency_admin', 'agency_member')], ADMIN = [auth, allow('agency_admin')], SA = [auth, allow('super_admin')], CL = [auth, allow('client')];

// Tenant + client scoped project lookup. Wrong agency OR wrong client => null => 404 (no existence leak).
async function getProject(ctx, id) {
  const [[p]] = await db.query('SELECT * FROM projects WHERE id=? AND agency_id=?', [id, ctx.agencyId]);
  return p && (ctx.role !== 'client' || p.client_id === ctx.clientId) ? p : null;
}
const PROGRESS = `(SELECT IFNULL(ROUND(100*SUM(t.status='done')/NULLIF(COUNT(*),0)),0) FROM tasks t WHERE t.project_id=p.id AND t.agency_id=p.agency_id)`;

// ---------- Auth ----------
app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password } = req.body || {};
  if (!req_(res, email && password, 'Email and password required')) return;
  const [[u]] = await db.query('SELECT * FROM users WHERE email=?', [String(email).toLowerCase()]);
  if (!u || !u.active || !(await bcrypt.compare(password, u.password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
  if (u.agency_id) {
    const [[a]] = await db.query('SELECT status FROM agencies WHERE id=?', [u.agency_id]);
    if (a.status !== 'active') return res.status(403).json({ error: 'This agency account is suspended. Please contact AppZex support.' });
  }
  res.json({ token: sign({ uid: u.id }), user: { id: u.id, name: u.name, role: u.role } });
}));

// ---------- Super Admin ----------
app.get('/api/admin/stats', SA, wrap(async (req, res) => {
  const [[s]] = await db.query(`SELECT (SELECT COUNT(*) FROM agencies) agencies,(SELECT COUNT(*) FROM agencies WHERE status='active') active,
    (SELECT COUNT(*) FROM users WHERE role<>'super_admin') users,(SELECT COUNT(*) FROM clients) clients,(SELECT COUNT(*) FROM projects) projects`);
  const [activity] = await db.query('SELECT l.*,a.name agency FROM activity_logs l LEFT JOIN agencies a ON a.id=l.agency_id ORDER BY l.id DESC LIMIT 25');
  res.json({ ...s, inactive: s.agencies - s.active, activity });
}));
app.get('/api/admin/agencies', SA, wrap(async (req, res) => {
  const { search = '', status, page = 1 } = req.query, lim = 20, off = (Math.max(+page, 1) - 1) * lim, w = ['1=1'], v = [];
  if (search) { w.push('(a.name LIKE ? OR a.owner_email LIKE ?)'); v.push(`%${search}%`, `%${search}%`); }
  if (['active', 'suspended'].includes(status)) { w.push('a.status=?'); v.push(status); }
  const [rows] = await db.query(`SELECT a.*,(SELECT COUNT(*) FROM users u WHERE u.agency_id=a.id) users,(SELECT COUNT(*) FROM clients c WHERE c.agency_id=a.id) clients,
    (SELECT COUNT(*) FROM projects p WHERE p.agency_id=a.id) projects FROM agencies a WHERE ${w.join(' AND ')} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`, [...v, lim, off]);
  res.json(rows);
}));
app.patch('/api/admin/agencies/:id/status', SA, wrap(async (req, res) => {
  if (!req_(res, ['active', 'suspended'].includes(req.body.status), 'Invalid status')) return;
  const [r] = await db.query('UPDATE agencies SET status=? WHERE id=?', [req.body.status, req.params.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
  await log(+req.params.id, req.ctx.uid, 'agency.status_changed', 'agency', +req.params.id, 0, { status: req.body.status });
  res.json({ ok: true });
}));
app.post('/api/admin/agencies/:id/support', SA, wrap(async (req, res) => { // short-lived, read-only, audited
  const [[a]] = await db.query('SELECT id,name FROM agencies WHERE id=?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Not found' });
  await log(a.id, req.ctx.uid, 'support.session_started', 'agency', a.id);
  res.json({ token: sign({ uid: req.ctx.uid, support: true, agencyId: a.id }, '30m'), agency: a.name });
}));

// ---------- Agency workspace ----------
app.get('/api/clients', AG, wrap(async (req, res) => res.json((await db.query('SELECT * FROM clients WHERE agency_id=? ORDER BY company', [req.ctx.agencyId]))[0])));
app.post('/api/clients', ADMIN, wrap(async (req, res) => {
  const { company, contact_name, email, phone, notes } = req.body || {};
  if (!req_(res, company && company.trim(), 'Company name required')) return;
  const [r] = await db.query('INSERT INTO clients(agency_id,company,contact_name,email,phone,notes) VALUES(?,?,?,?,?,?)', [req.ctx.agencyId, company.trim(), contact_name, email, phone, notes]);
  await log(req.ctx.agencyId, req.ctx.uid, 'client.created', 'client', r.insertId); res.status(201).json({ id: r.insertId });
}));
app.get('/api/projects', AG, wrap(async (req, res) => res.json((await db.query(`SELECT p.*,c.company,${PROGRESS} progress FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.agency_id=? ORDER BY p.due_date`, [req.ctx.agencyId]))[0])));
app.post('/api/projects', ADMIN, wrap(async (req, res) => {
  const { name, description, client_id, start_date, due_date, priority, manager_id } = req.body || {};
  if (!req_(res, name && description && client_id, 'Name, description and client required')) return;
  const [[c]] = await db.query('SELECT id FROM clients WHERE id=? AND agency_id=?', [client_id, req.ctx.agencyId]); // client must be same agency
  if (!req_(res, c, 'Invalid client')) return;
  if (manager_id) { const [[m]] = await db.query('SELECT id FROM users WHERE id=? AND agency_id=?', [manager_id, req.ctx.agencyId]); if (!req_(res, m, 'Invalid manager')) return; }
  const [r] = await db.query('INSERT INTO projects(agency_id,client_id,name,description,start_date,due_date,priority,manager_id) VALUES(?,?,?,?,?,?,?,?)',
    [req.ctx.agencyId, client_id, name, description, start_date || null, due_date || null, ['low', 'medium', 'high'].includes(priority) ? priority : 'medium', manager_id || null]);
  await log(req.ctx.agencyId, req.ctx.uid, 'project.created', 'project', r.insertId, 1, { name }); res.status(201).json({ id: r.insertId });
}));
app.get('/api/projects/:id', AG, wrap(async (req, res) => {
  const p = await getProject(req.ctx, req.params.id); if (!p) return res.status(404).json({ error: 'Not found' });
  const q = t => db.query(`SELECT * FROM ${t} WHERE project_id=? AND agency_id=?`, [p.id, req.ctx.agencyId]).then(r => r[0]);
  const tasks = await q('tasks'); const done = tasks.filter(t => t.status === 'done').length;
  res.json({ ...p, progress: tasks.length ? Math.round(100 * done / tasks.length) : 0, tasks, feedback: await q('feedback'), files: await q('files') });
}));
app.post('/api/projects/:id/tasks', AG, wrap(async (req, res) => {
  const p = await getProject(req.ctx, req.params.id); if (!p) return res.status(404).json({ error: 'Not found' });
  const { title, description, assignee_id, priority, due_date } = req.body || {};
  if (!req_(res, title && title.trim(), 'Title required')) return;
  if (assignee_id) { const [[m]] = await db.query('SELECT id FROM users WHERE id=? AND agency_id=?', [assignee_id, req.ctx.agencyId]); if (!req_(res, m, 'Invalid assignee')) return; }
  const [r] = await db.query('INSERT INTO tasks(agency_id,project_id,title,description,assignee_id,priority,due_date) VALUES(?,?,?,?,?,?,?)',
    [req.ctx.agencyId, p.id, title.trim(), description, assignee_id || null, ['low', 'medium', 'high'].includes(priority) ? priority : 'medium', due_date || null]);
  await log(req.ctx.agencyId, req.ctx.uid, 'task.created', 'task', r.insertId, 0, { project: p.id }); res.status(201).json({ id: r.insertId });
}));
app.patch('/api/tasks/:id', AG, wrap(async (req, res) => {
  const f = ['title', 'description', 'status', 'priority', 'due_date'].filter(k => k in req.body);
  if (!req_(res, f.length, 'Nothing to update')) return;
  if ('status' in req.body && !req_(res, ['todo', 'in_progress', 'done'].includes(req.body.status), 'Invalid status')) return;
  const [r] = await db.query(`UPDATE tasks SET ${f.map(k => k + '=?').join(',')} WHERE id=? AND agency_id=?`, [...f.map(k => req.body[k]), req.params.id, req.ctx.agencyId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
  if (req.body.status === 'done') await log(req.ctx.agencyId, req.ctx.uid, 'task.completed', 'task', +req.params.id, 0);
  res.json({ ok: true });
}));
app.get('/api/feedback', AG, wrap(async (req, res) => res.json((await db.query('SELECT f.*,p.name project FROM feedback f JOIN projects p ON p.id=f.project_id WHERE f.agency_id=? ORDER BY f.created_at DESC', [req.ctx.agencyId]))[0])));
app.patch('/api/feedback/:id', AG, wrap(async (req, res) => {
  if (!req_(res, ['open', 'in_review', 'in_progress', 'resolved', 'declined'].includes(req.body.status), 'Invalid status')) return;
  const [r] = await db.query('UPDATE feedback SET status=? WHERE id=? AND agency_id=?', [req.body.status, req.params.id, req.ctx.agencyId]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Not found' });
  await log(req.ctx.agencyId, req.ctx.uid, 'feedback.status_changed', 'feedback', +req.params.id, 1, { status: req.body.status }); res.json({ ok: true });
}));

// ---------- Client portal (role=client, scoped by agency_id AND client_id) ----------
app.get('/api/portal/projects', CL, wrap(async (req, res) => res.json((await db.query(`SELECT p.id,p.name,p.status,p.due_date,${PROGRESS} progress FROM projects p WHERE p.agency_id=? AND p.client_id=?`, [req.ctx.agencyId, req.ctx.clientId]))[0])));
app.get('/api/portal/projects/:id', CL, wrap(async (req, res) => {
  const p = await getProject(req.ctx, req.params.id); if (!p) return res.status(404).json({ error: 'Not found' });
  const [tasks] = await db.query("SELECT title,status,due_date FROM tasks WHERE project_id=? AND agency_id=? AND status<>'done' AND due_date IS NOT NULL ORDER BY due_date LIMIT 10", [p.id, p.agency_id]);
  const [updates] = await db.query("SELECT event_type,meta,created_at FROM activity_logs WHERE agency_id=? AND entity_type='project' AND entity_id=? AND visible_to_client=1 ORDER BY id DESC LIMIT 20", [p.agency_id, p.id]);
  const [files] = await db.query('SELECT id,original_name FROM files WHERE project_id=? AND agency_id=? AND shared_with_client=1', [p.id, p.agency_id]);
  const [feedback] = await db.query('SELECT id,title,status,created_at FROM feedback WHERE project_id=? AND agency_id=? AND submitted_by=?', [p.id, p.agency_id, req.ctx.uid]);
  res.json({ id: p.id, name: p.name, description: p.description, status: p.status, due_date: p.due_date, upcoming: tasks, updates, files, feedback });
}));
app.post('/api/portal/projects/:id/feedback', CL, wrap(async (req, res) => {
  const p = await getProject(req.ctx, req.params.id); if (!p) return res.status(404).json({ error: 'Not found' });
  const { title, description } = req.body || {}; if (!req_(res, title && title.trim(), 'Title required')) return;
  const [r] = await db.query('INSERT INTO feedback(agency_id,project_id,submitted_by,title,description) VALUES(?,?,?,?,?)', [p.agency_id, p.id, req.ctx.uid, title.trim(), description]);
  await log(p.agency_id, req.ctx.uid, 'feedback.submitted', 'project', p.id, 1, { title }); res.status(201).json({ id: r.insertId });
}));

// ---------- Files (private dir + permission-checked download) ----------
app.post('/api/projects/:id/files', AG, upload.single('file'), wrap(async (req, res) => {
  const p = await getProject(req.ctx, req.params.id);
  if (!p || !req.file) { if (req.file) fs.unlinkSync(req.file.path); return res.status(p ? 400 : 404).json({ error: p ? 'File required' : 'Not found' }); }
  const [r] = await db.query('INSERT INTO files(agency_id,project_id,uploaded_by,original_name,stored_name,shared_with_client) VALUES(?,?,?,?,?,?)',
    [p.agency_id, p.id, req.ctx.uid, req.file.originalname, req.file.filename, req.body.shared === 'true' ? 1 : 0]);
  await log(p.agency_id, req.ctx.uid, 'file.uploaded', 'project', p.id, req.body.shared === 'true', { name: req.file.originalname }); res.status(201).json({ id: r.insertId });
}));
app.get('/api/files/:id/download', auth, wrap(async (req, res) => {
  const [[f]] = await db.query('SELECT f.*,p.client_id FROM files f JOIN projects p ON p.id=f.project_id WHERE f.id=? AND f.agency_id=?', [req.params.id, req.ctx.agencyId]);
  const ok = f && (req.ctx.role === 'client' ? f.client_id === req.ctx.clientId && f.shared_with_client : ['agency_admin', 'agency_member'].includes(req.ctx.role));
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.download(path.join(UPLOAD_DIR, path.basename(f.stored_name)), f.original_name);
}));

// ---------- AI: Project Health (only this project's data is sent) ----------
app.post('/api/projects/:id/ai/health', AG, wrap(async (req, res) => {
  const p = await getProject(req.ctx, req.params.id); if (!p) return res.status(404).json({ error: 'Not found' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI is not configured on this server.' });
  const sel = t => db.query(`SELECT * FROM ${t} WHERE project_id=? AND agency_id=?`, [p.id, p.agency_id]).then(r => r[0]);
  const [tasks, fb] = [await sel('tasks'), await sel('feedback')];
  const data = { project: { name: p.name, status: p.status, due: p.due_date, today: new Date().toISOString().slice(0, 10) },
    tasks: tasks.map(t => ({ title: t.title, status: t.status, priority: t.priority, due: t.due_date })), feedback: fb.map(f => ({ title: f.title, status: f.status })) };
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: process.env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 700,
        system: 'You are a project health analyst for an agency. Given JSON project data, reply with: 1) a 2-sentence status summary, 2) a risk level (Low/Medium/High), 3) up to 4 concrete risks (overdue tasks, stalled work, unresolved feedback), 4) up to 3 suggested next actions. Use only the given data. Be concise.',
        messages: [{ role: 'user', content: JSON.stringify(data) }] }) });
    if (!r.ok) throw new Error('upstream ' + r.status);
    const j = await r.json(); await log(p.agency_id, req.ctx.uid, 'ai.health_generated', 'project', p.id);
    res.json({ report: j.content.filter(c => c.type === 'text').map(c => c.text).join('\n') });
  } catch (e) { res.status(502).json({ error: 'AI is unavailable right now. Please try again shortly.' }); }
}));

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.listen(process.env.PORT || 4000, () => console.log('API on', process.env.PORT || 4000));
