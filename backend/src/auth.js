const jwt = require('jsonwebtoken');
const db = require('./db');
const sign = (p, exp = '8h') => jwt.sign(p, process.env.JWT_SECRET, { expiresIn: exp });

// Central authN + tenant context. Every request re-reads the user and agency status from the DB,
// so suspension and deactivation take effect immediately (no stale-JWT window).
async function auth(req, res, next) {
  try {
    const t = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET);
    const [[u]] = await db.query('SELECT id,name,role,agency_id,client_id,active FROM users WHERE id=?', [t.uid]);
    if (!u || !u.active) return res.status(401).json({ error: 'Invalid session' });
    const ctx = { uid: u.id, name: u.name, role: u.role, agencyId: u.agency_id, clientId: u.client_id, support: false };
    if (u.role === 'super_admin' && t.support) { // support mode: read-only agency_admin view of ONE agency
      Object.assign(ctx, { support: true, agencyId: t.agencyId, role: 'agency_admin' });
      if (req.method !== 'GET') return res.status(403).json({ error: 'Support mode is read-only' });
    } else if (ctx.agencyId) {
      const [[a]] = await db.query('SELECT status FROM agencies WHERE id=?', [ctx.agencyId]);
      if (!a || a.status !== 'active') return res.status(403).json({ error: 'This agency account is suspended. Please contact AppZex support.' });
    }
    req.ctx = ctx; next();
  } catch { res.status(401).json({ error: 'Unauthorized' }); }
}
const allow = (...roles) => (req, res, next) => roles.includes(req.ctx.role) ? next() : res.status(403).json({ error: 'Forbidden' });
const log = (agencyId, actorId, type, entityType, entityId, visible = 0, meta = {}) =>
  db.query('INSERT INTO activity_logs(agency_id,actor_id,event_type,entity_type,entity_id,visible_to_client,meta) VALUES(?,?,?,?,?,?,?)',
    [agencyId, actorId, type, entityType, entityId, visible ? 1 : 0, JSON.stringify(meta)]);
module.exports = { sign, auth, allow, log };
