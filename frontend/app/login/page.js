'use client';
import { useState } from 'react';
import { api, homeFor } from '../../lib/api';
const DEMO = [['Super Admin', 'super@appzex.test'], ['Agency Admin', 'admin@pixel.test'], ['Team', 'team@pixel.test'], ['Client', 'client.acme@pixel.test']];
export default function Login() {
  const [email, setEmail] = useState(''), [password, setPassword] = useState('Demo@1234'), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const d = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      localStorage.setItem('token', d.token); localStorage.setItem('role', d.user.role); localStorage.setItem('name', d.user.name);
      location.href = homeFor(d.user.role);
    } catch (e) { setErr(e.message); setBusy(false); }
  }
  return (
    <form className="login" onSubmit={submit}>
      <h2 style={{ margin: 0 }}>AppZex PM: Sign in</h2>
      {err && <div className="err">{err}</div>}
      <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
      <button disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      <div className="hint">Demo (click to fill): {DEMO.map(([l, em]) => <span key={em} onClick={() => setEmail(em)}>{l} </span>)}</div>
    </form>
  );
}
