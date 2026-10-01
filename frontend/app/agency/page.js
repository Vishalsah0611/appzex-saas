'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
const today = () => new Date().toISOString().slice(0, 10);
const soon = d => d && d >= today() && d <= new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
export default function Agency() {
  const [tab, setTab] = useState('dashboard'), [clients, setClients] = useState([]), [projects, setProjects] = useState([]), [feedback, setFeedback] = useState([]), [err, setErr] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [cf, setCf] = useState({ company: '', contact_name: '', email: '', phone: '', notes: '' }), [pf, setPf] = useState({ name: '', description: '', client_id: '', due_date: '' });
  const load = useCallback(async () => {
    try { const [c, p, f] = await Promise.all([api('/api/clients'), api('/api/projects'), api('/api/feedback')]); setClients(c); setProjects(p); setFeedback(f); setErr(''); }
    catch (e) { setErr(e.message); }
  }, []);
  useEffect(() => { setCanEdit(localStorage.getItem('role') === 'agency_admin' && !localStorage.getItem('supportAgency')); load(); }, [load]);
  async function save(path, body, reset) { try { await api(path, { method: 'POST', body }); reset(); load(); } catch (e) { setErr(e.message); } }
  async function setFb(id, status) { try { await api('/api/feedback/' + id, { method: 'PATCH', body: { status } }); load(); } catch (e) { setErr(e.message); } }
  const pending = feedback.filter(f => ['open', 'in_review', 'in_progress'].includes(f.status)).length;
  const C = ({ l, v }) => <div className="card">{l}<b>{v}</b></div>;
  const Bar = ({ v }) => <div style={{ background: '#e6eaf3', borderRadius: 6, width: 120, display: 'inline-block' }}><div style={{ width: v + '%', background: '#2453e8', height: 8, borderRadius: 6 }} /></div>;
  return (<div className="wrap">
    {err && <div className="err">{err}</div>}
    <div className="row">{['dashboard', 'projects', 'clients', 'feedback'].map(t => <button key={t} className={tab === t ? '' : 'grey'} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
    {tab === 'dashboard' && <>
      <div className="cards"><C l="Clients" v={clients.length} /><C l="Active projects" v={projects.filter(p => p.status === 'active').length} /><C l="Due in 7 days" v={projects.filter(p => p.status !== 'completed' && soon(p.due_date)).length} />
        <C l="Completed" v={projects.filter(p => p.status === 'completed').length} /><C l="Pending feedback" v={pending} /></div>
      <h3>Project progress</h3><table><tbody>{projects.map(p => <tr key={p.id}><td>{p.name}</td><td><Bar v={p.progress} /> {p.progress}%</td></tr>)}</tbody></table></>}
    {tab === 'projects' && <>
      {canEdit && <div className="row"><input placeholder="Project name" value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} /><input placeholder="Description" value={pf.description} onChange={e => setPf({ ...pf, description: e.target.value })} />
        <select value={pf.client_id} onChange={e => setPf({ ...pf, client_id: e.target.value })}><option value="">Client...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}</select>
        <input type="date" value={pf.due_date} onChange={e => setPf({ ...pf, due_date: e.target.value })} />
        <button onClick={() => save('/api/projects', pf, () => setPf({ name: '', description: '', client_id: '', due_date: '' }))}>Add project</button></div>}
      <table><thead><tr><th>Project</th><th>Client</th><th>Status</th><th>Priority</th><th>Due</th><th>Progress</th></tr></thead><tbody>
        {projects.map(p => <tr key={p.id}><td><Link href={'/agency/projects/' + p.id}>{p.name}</Link></td><td>{p.company}</td><td>{p.status}</td><td>{p.priority}</td><td>{p.due_date}</td><td><Bar v={p.progress} /> {p.progress}%</td></tr>)}
        {!projects.length && <tr><td colSpan="6">No projects yet.</td></tr>}</tbody></table></>}
    {tab === 'clients' && <>
      {canEdit && <div className="row">{['company', 'contact_name', 'email', 'phone', 'notes'].map(k => <input key={k} placeholder={k.replace('_', ' ')} value={cf[k]} onChange={e => setCf({ ...cf, [k]: e.target.value })} />)}
        <button onClick={() => save('/api/clients', cf, () => setCf({ company: '', contact_name: '', email: '', phone: '', notes: '' }))}>Add client</button></div>}
      <table><thead><tr><th>Company</th><th>Contact</th><th>Email</th><th>Phone</th><th>Notes</th></tr></thead><tbody>
        {clients.map(c => <tr key={c.id}><td>{c.company}</td><td>{c.contact_name}</td><td>{c.email}</td><td>{c.phone}</td><td>{c.notes}</td></tr>)}
        {!clients.length && <tr><td colSpan="5">No clients yet.</td></tr>}</tbody></table></>}
    {tab === 'feedback' && <table><thead><tr><th>Project</th><th>Title</th><th>Description</th><th>Status</th></tr></thead><tbody>
      {feedback.map(f => <tr key={f.id}><td>{f.project}</td><td>{f.title}</td><td>{f.description}</td><td>
        <select value={f.status} disabled={!localStorage.getItem('token') || !!localStorage.getItem('supportAgency')} onChange={e => setFb(f.id, e.target.value)}>{['open', 'in_review', 'in_progress', 'resolved', 'declined'].map(s => <option key={s}>{s}</option>)}</select></td></tr>)}
      {!feedback.length && <tr><td colSpan="4">No client feedback yet.</td></tr>}</tbody></table>}
  </div>);
}
