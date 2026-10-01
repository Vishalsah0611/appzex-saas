require('dotenv').config();
const bcrypt = require('bcryptjs'), db = require('./db');
(async () => {
  const h = await bcrypt.hash('Demo@1234', 10), d = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  await db.query('SET FOREIGN_KEY_CHECKS=0'); for (const t of ['activity_logs', 'files', 'feedback', 'tasks', 'projects', 'users', 'clients', 'agencies']) await db.query(`TRUNCATE ${t}`); await db.query('SET FOREIGN_KEY_CHECKS=1');
  await db.query("INSERT INTO users(email,password_hash,name,role) VALUES('super@appzex.test',?,'AppZex Super Admin','super_admin')", [h]);
  for (const [n, slug] of [['Pixel Forge Agency', 'pixel'], ['Nova Digital', 'nova']]) {
    const [a] = await db.query('INSERT INTO agencies(name,owner_email,plan) VALUES(?,?,?)', [n, `admin@${slug}.test`, 'pro']);
    const [ad] = await db.query("INSERT INTO users(email,password_hash,name,role,agency_id) VALUES(?,?,?,'agency_admin',?)", [`admin@${slug}.test`, h, `${n} Admin`, a.insertId]);
    const [tm] = await db.query("INSERT INTO users(email,password_hash,name,role,agency_id) VALUES(?,?,?,'agency_member',?)", [`team@${slug}.test`, h, `${n} Designer`, a.insertId]);
    for (const c of ['Acme Corp', 'Globex Ltd']) {
      const [cl] = await db.query('INSERT INTO clients(agency_id,company,contact_name,email) VALUES(?,?,?,?)', [a.insertId, `${c} (${slug})`, 'Main Contact', `contact@${c.split(' ')[0].toLowerCase()}-${slug}.test`]);
      await db.query("INSERT INTO users(email,password_hash,name,role,agency_id,client_id) VALUES(?,?,?,'client',?,?)", [`client.${c.split(' ')[0].toLowerCase()}@${slug}.test`, h, `${c} Client`, a.insertId, cl.insertId]);
      const [p] = await db.query('INSERT INTO projects(agency_id,client_id,name,description,start_date,due_date,manager_id,priority) VALUES(?,?,?,?,?,?,?,?)', [a.insertId, cl.insertId, `${c} Website Redesign`, 'Full redesign and launch', d(-20), d(14), ad.insertId, 'high']);
      const T = [['Wireframes', 'done', -10], ['Homepage design', 'done', -5], ['Frontend build', 'in_progress', -2], ['QA testing', 'todo', 7]];
      for (const [t, s, o] of T) await db.query('INSERT INTO tasks(agency_id,project_id,title,assignee_id,status,due_date) VALUES(?,?,?,?,?,?)', [a.insertId, p.insertId, t, tm.insertId, s, d(o)]);
      await db.query("INSERT INTO activity_logs(agency_id,actor_id,event_type,entity_type,entity_id,visible_to_client,meta) VALUES(?,?,'project.created','project',?,1,'{}')", [a.insertId, ad.insertId, p.insertId]);
    }
  }
  console.log('Seeded. All demo passwords: Demo@1234'); process.exit(0);
})();
