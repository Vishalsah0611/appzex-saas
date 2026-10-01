'use client';
import { useEffect, useState, useCallback } from 'react';
import { api, logout } from '../../lib/api';
export default function Admin() {
  const [stats, setStats] = useState(null), [agencies, setAgencies] = useState([]), [search, setSearch] = useState(''), [status, setStatus] = useState(''), [err, setErr] = useState('');
  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams({ search, status }).toString();
      const [s, a] = await Promise.all([api('/api/admin/stats'), api('/api/admin/agencies?' + q)]);
      setStats(s); setAgencies(a); setErr('');
    } catch (e) { setErr(e.message); }
  }, [search, status]);
  useEffect(() => { if (localStorage.getItem('role') !== 'super_admin') { location.href = '/login'; return; } load(); }, [load]);
  async function toggle(a) {
    const next = a.status === 'active' ? 'suspended' : 'active';
    if (!confirm(`${next === 'suspended' ? 'Suspend' : 'Activate'} ${a.name}?`)) return;
    await api(`/api/admin/agencies/${a.id}/status`, { method: 'PATCH', body: { status: next } }); load();
  }
  async function support(a) {
    const r = await api(`/api/admin/agencies/${a.id}/support`, { method: 'POST' });
    localStorage.setItem('adminToken', localStorage.getItem('token')); localStorage.setItem('token', r.token);
    localStorage.setItem('supportAgency', r.agency); localStorage.setItem('role', 'agency_admin'); location.href = '/agency';
  }
  const C = ({ l, v }) => <div className="card">{l}<b>{v ?? '-'}</b></div>;
  return (<>
    <div className="top"><b>AppZex Super Admin</b><button className="grey" onClick={logout}>Logout</button></div>
    <div className="wrap">
      {err && <div className="err">{err}</div>}
      <div className="cards"><C l="Agencies" v={stats?.agencies} /><C l="Active" v={stats?.active} /><C l="Inactive" v={stats?.inactive} /><C l="Users" v={stats?.users} /><C l="Clients" v={stats?.clients} /><C l="Projects" v={stats?.projects} /></div>
      <h3>Agencies</h3>
      <div className="row"><input placeholder="Search name or email" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={status} onChange={e => setStatus(e.target.value)}><option value="">All</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
      <table><thead><tr><th>Agency</th><th>Owner</th><th>Status</th><th>Plan</th><th>Users</th><th>Clients</th><th>Projects</th><th>Created</th><th></th></tr></thead>
        <tbody>{agencies.map(a => (<tr key={a.id}><td>{a.name}</td><td>{a.owner_email}</td><td><span className={'badge ' + a.status}>{a.status}</span></td><td>{a.plan}</td><td>{a.users}</td><td>{a.clients}</td><td>{a.projects}</td><td>{a.created_at?.slice(0, 10)}</td>
          <td style={{ whiteSpace: 'nowrap' }}><button onClick={() => support(a)}>Support mode</button> <button className={a.status === 'active' ? 'red' : 'green'} onClick={() => toggle(a)}>{a.status === 'active' ? 'Suspend' : 'Activate'}</button></td></tr>))}
          {!agencies.length && <tr><td colSpan="9">No agencies found.</td></tr>}</tbody></table>
      <h3>Recent platform activity</h3>
      <table><thead><tr><th>When</th><th>Agency</th><th>Event</th></tr></thead><tbody>
        {stats?.activity.map(l => <tr key={l.id}><td>{l.created_at}</td><td>{l.agency || '-'}</td><td>{l.event_type}</td></tr>)}
        {!stats?.activity.length && <tr><td colSpan="3">No activity yet.</td></tr>}</tbody></table>
    </div></>);
}
