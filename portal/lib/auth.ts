import type { components } from '../../contracts/generated/api';
export type Me = components['schemas']['Me'];
export function validOrigin(request: Request): boolean {
  try {
    const origin=new URL(request.headers.get('origin')??'');
    const host=request.headers.get('host')??new URL(request.url).host;
    return origin.host===host && (origin.protocol==='https:' || (origin.protocol==='http:' && process.env.NODE_ENV!=='production'));
  } catch { return false; }
}
export async function authenticate(form: FormData, fetcher: typeof fetch = fetch): Promise<{token: string; expires: number; me: Me}> {
  let token: string; let expires = 3600;
  if (form.get('mode') === 'demo') {
    if (process.env.NODE_ENV === 'production' || process.env.PORTAL_DEMO_AUTH !== 'true') throw new Error('Demo sign-in is disabled.');
    token = 'demo-clinician-token';
  } else {
    const url = process.env.RE_SUPABASE_URL; const key = process.env.RE_SUPABASE_ANON_KEY;
    const email = String(form.get('email') ?? '').trim(); const password = String(form.get('password') ?? '');
    if (!url || !key || !email || !password || email.length > 320 || password.length > 1024) throw new Error('Configure Supabase and enter your clinician credentials.');
    const response = await fetcher(new URL('/auth/v1/token?grant_type=password', url), { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({email,password}), cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Sign-in failed. Check your clinician credentials.');
    const session = await response.json(); token = session.access_token; expires = Math.min(Number(session.expires_in) || 3600, 3600);
    if (typeof token !== 'string' || !token) throw new Error('Sign-in failed.');
  }
  const response = await fetcher(new URL('/v1/me', process.env.RE_API_URL ?? 'http://127.0.0.1:8000'), { headers: {Authorization: `Bearer ${token}`}, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('A verified clinician account is required.');
  const me = await response.json() as Me;
  if (me.role !== 'clinician' || !me.clinician_verified) throw new Error('A verified clinician account is required.');
  return {token,expires,me};
}
