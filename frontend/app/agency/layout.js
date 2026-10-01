'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { logout } from '../../lib/api';
export default function AgencyLayout({ children }) {
  const [ok, setOk] = useState(false), [agency, setAgency] = useState(null), [name, setName] = useState('');
  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'agency_admin' && role !== 'agency_member') { location.href = '/login'; return; }
    setAgency(localStorage.getItem('supportAgency')); setName(localStorage.getItem('name') || ''); setOk(true);
  }, []);
  function exitSupport() {
    localStorage.setItem('token', localStorage.getItem('adminToken')); localStorage.setItem('role', 'super_admin');
    localStorage.removeItem('adminToken'); localStorage.removeItem('supportAgency'); location.href = '/admin';
  }
  if (!ok) return null;
  return (<>
    {agency && <div style={{ background: '#f5a623', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <b>You are viewing {agency} as Super Admin (read-only)</b><button className="grey" onClick={exitSupport}>Exit support mode</button></div>}
    <div className="top"><Link href="/agency" style={{ color: '#fff', fontWeight: 700, textDecoration: 'none' }}>AppZex Workspace</Link>
      {!agency && <span>{name} <button className="grey" onClick={logout}>Logout</button></span>}</div>
    {children}</>);
}
