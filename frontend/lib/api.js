const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export async function api(path, opts = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { localStorage.clear(); location.href = '/login'; }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const homeFor = r => (r === 'super_admin' ? '/admin' : r === 'client' ? '/portal' : '/agency');
export const logout = () => { localStorage.clear(); location.href = '/login'; };
