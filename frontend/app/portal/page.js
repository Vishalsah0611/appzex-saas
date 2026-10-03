'use client';
import { useEffect, useState, useCallback } from 'react';
import { api, logout } from '../../lib/api';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const label = t => t.replace(/[._]/g, ' ');
const Badge = ({ s }) => <span className={'badge ' + s}>{String(s).replace('_', ' ')}</span>;
const Bar = ({ v }) => <div className="bar" style={{ width: '100%', margin: '10px 0' }}><i style={{ width: v + '%' }} /></div>;
export default function Portal() {
  const [name, setName] = useState(''), [list, setList] = useState([]), [sel, setSel] = useState(null), [d, setD] = useState(null), [err, setErr] = useState(''), [fb, setFb] = useState({ title: '', description: '' }), [msg, setMsg] = useState('');
  useEffect(() => {
    if (localStorage.getItem('role') !== 'client') { location.href = '/login'; return; }
    setName(localStorage.getItem('name') || '');
    api('/api/portal/projects').then(setList).catch(e => setErr(e.message));
  }, []);
  const open = useCallback(async id => { setSel(id); setMsg(''); try { setD(await api('/api/portal/projects/' + id)); setErr(''); } catch (e) { setErr(e.message); } }, []);
  async function send() {
    try { await api(`/api/portal/projects/${sel}/feedback`, { method: 'POST', body: fb }); setFb({ title: '', description: '' }); setMsg('Request sent to the agency.'); open(sel); }
    catch (e) { setErr(e.message); }
  }
  async function download(f) {
    const r = await fetch(`${API}/api/files/${f.id}/download`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    if (!r.ok) return setErr('Download not allowed');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = f.original_name; a.click();
  }
  return (<>
    <div className="top"><b>Client Portal</b><span>{name} <button className="grey" onClick={logout}>Logout</button></span></div>
    <div className="wrap">
      <h2>Welcome, {name.split(' ')[0] || 'there'}</h2>
      {err && <div className="err">{err}</div>}
      {!sel && <div className="cards">{list.map(p => <div key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => open(p.id)}>
        <b style={{ fontSize: 18 }}>{p.name}</b><Bar v={p.progress} />{p.progress}% complete &middot; <Badge s={p.status} /> &middot; due {p.due_date || 'n/a'}</div>)}
        {!list.length && <div className="card">No projects yet.</div>}</div>}
      {sel && d && <>
        <button className="grey" onClick={() => { setSel(null); setD(null); }}>&larr; All projects</button>
        <h3>{d.name} <Badge s={d.status} /></h3><p>{d.description} (due {d.due_date || 'n/a'})</p>
        <h3>Upcoming milestones</h3>
        <table><tbody>{d.upcoming.map((t, i) => <tr key={i}><td>{t.title}</td><td><Badge s={t.status} /></td><td>{t.due_date}</td></tr>)}{!d.upcoming.length && <tr><td>Nothing upcoming.</td></tr>}</tbody></table>
        <h3>Recent updates</h3>
        <table><tbody>{d.updates.map((u, i) => <tr key={i}><td>{u.created_at}</td><td>{label(u.event_type)}</td></tr>)}{!d.updates.length && <tr><td>No updates yet.</td></tr>}</tbody></table>
        <h3>Shared files</h3>
        <table><tbody>{d.files.map(f => <tr key={f.id}><td>{f.original_name}</td><td><button onClick={() => download(f)}>Download</button></td></tr>)}{!d.files.length && <tr><td>No files shared yet.</td></tr>}</tbody></table>
        <h3>Send feedback / change request</h3>
        {msg && <div className="card ai" style={{ marginBottom: 8 }}>{msg}</div>}
        <div className="row"><input placeholder="Title" value={fb.title} onChange={e => setFb({ ...fb, title: e.target.value })} /><input style={{ flex: 1, minWidth: 240 }} placeholder="Describe what you need" value={fb.description} onChange={e => setFb({ ...fb, description: e.target.value })} /><button onClick={send}>Send</button></div>
        <h3>Your requests</h3>
        <table><tbody>{d.feedback.map(f => <tr key={f.id}><td>{f.title}</td><td><Badge s={f.status} /></td><td>{f.created_at}</td></tr>)}{!d.feedback.length && <tr><td>No requests yet.</td></tr>}</tbody></table></>}
    </div></>);
}