'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homeFor } from '../lib/api';
export default function Home() {
  const r = useRouter();
  useEffect(() => { const role = localStorage.getItem('role'); r.replace(role ? homeFor(role) : '/login'); }, [r]);
  return null;
}
