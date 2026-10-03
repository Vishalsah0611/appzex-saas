'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../../lib/api';
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const today = () => new Date().toISOString().slice(0, 10);
export default function ProjectPage() {
  const { id } = useParams();
  const [p, setP] = useState(null), [err, setErr] = useState(''), [ro, setRo] = useState(false), [t, setT] = useState({ title: '', due_date: '', priority: 'medium' });
  const [shared, setShared] = useState(false), [ai, setAi] = useState(''), [aiBusy, setAiBusy] = useState(false);
  const load = useCallback(async () => { try { setP(await api('/api/projects/' + id)); setErr(''); } catch (e) { setErr(e.message); } }, [id]);
  useEffect(() => { setRo(!!localStorage.getItem('supportAgency')); load(); }, [load]);
  const run = async fn => { try { await fn(); load(); } catch (e) { setErr(e.message); } };
  const addTask = () => run(async () => { await api(`/api/projects/${id}/tasks`, { method: 'POST', body: t }); setT({ title: '', due_date: '', priority: 'medium' }); });
  const setStatus = (tid, status) => run(() => api('/api/tasks/' + tid, { method: 'PATCH', body: { status } }));
  const upload = e => run(async () => {
    const f = e.target.files[0]; if (!f) return; const fd = new FormData(); fd.append('file', f); fd.append('shared', shared);
    const r = await fetch(`${API}/api/projects/${id}/files`, { method: 'POST', headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }, body: fd });
    if (!r.ok) throw new Error((await r.json()).error || 'Upload failed'); e.target.value = '';
  });
  async function download(f) { // permission-checked download (token in header, saved via blob)
    const r = await fetch(`${API}/api/files/${f.id}/download`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } });
    if (!r.ok) return setErr('Download not allowed');
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = f.original_name; a.click();
  }
  async function health() { setAiBusy(true); setAi(''); try { setAi((await api(`/api/projects/${id}/ai/health`, { method: 'POST' })).report); } catch (e) { setAi('⚠ ' + e.message); } setAiBusy(false); }
  if (err && !p) return <div className="wrap"><div className="err">{err}</div><Link href="/agency">Back</Link></div>;
  if (!p) return null;
  return (<div className="wrap">
    <Link href="/agency">&larr; Back</Link>
    {err && <div className="err">{err}</div>}
    <h2>{p.name} <span className={'badge ' + p.status}>{p.status.replace('_', ' ')}</span></h2><p>{p.description} (Due {p.due_date || 'n/a'}, progress <b>{p.progress}%</b>)</p>
    <div className="row"><button onClick={health} disabled={aiBusy}>{aiBusy ? 'Analysing...' : 'AI Project Health'}</button></div>
    {ai && <div className="card ai" style={{ whiteSpace: 'pre-wrap', marginBottom: 16 }}>{ai}</div>}
    <h3>Tasks</h3>
    {!ro && <div className="row"><input placeholder="New task title" value={t.title} onChange={e => setT({ ...t, title: e.target.value })} /><input type="date" value={t.due_date} onChange={e => setT({ ...t, due_date: e.target.value })} />
      <select value={t.priority} onChange={e => setT({ ...t, priority: e.target.value })}>{['low', 'medium', 'high'].map(x => <option key={x}>{x}</option>)}</select><button onClick={addTask}>Add task</button></div>}
    <table><thead><tr><th>Task</th><th>Priority</th><th>Due</th><th>Status</th></tr></thead><tbody>
      {p.tasks.map(k => <tr key={k.id}><td>{k.title}</td><td><span className={'badge ' + k.priority}>{k.priority}</span></td><td>{k.due_date} {k.status !== 'done' && k.due_date && k.due_date < today() && <span className="badge suspended">overdue</span>}</td>
        <td><select disabled={ro} value={k.status} onChange={e => setStatus(k.id, e.target.value)}>{['todo', 'in_progress', 'done'].map(s => <option key={s}>{s}</option>)}</select></td></tr>)}
      {!p.tasks.length && <tr><td colSpan="4">No tasks yet.</td></tr>}</tbody></table>
    <h3>Files</h3>
    {!ro && <div className="row"><input type="file" onChange={upload} /><label><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} /> Share with client</label></div>}
    <table><tbody>{p.files.map(f => <tr key={f.id}><td>{f.original_name}</td><td><span className={'badge ' + (f.shared_with_client ? 'active' : '')}>{f.shared_with_client ? 'Shared with client' : 'Internal'}</span></td><td><button onClick={() => download(f)}>Download</button></td></tr>)}
      {!p.files.length && <tr><td>No files yet.</td></tr>}</tbody></table>
    <h3>Client feedback</h3>
    <table><tbody>{p.feedback.map(f => <tr key={f.id}><td>{f.title}</td><td>{f.description}</td><td><span className={'badge ' + f.status}>{f.status.replace('_', ' ')}</span></td></tr>)}{!p.feedback.length && <tr><td>None yet.</td></tr>}</tbody></table>
  </div>);
}