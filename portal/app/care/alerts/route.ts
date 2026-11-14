import { openSession } from '@/lib/session';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { validOrigin } from '@/lib/auth';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request: Request) {
  if (!validOrigin(request)) return new Response('Invalid origin',{status:403});
  const origin=request.headers.get('origin')!;
  const token=openSession((await cookies()).get('re_access_token')?.value);
  if (!token) return NextResponse.redirect(new URL('/login',origin),303);
  const form=await request.formData();
  const field=(name:string)=>{const value=form.get(name);return typeof value==='string'?value:'';};
  const patientId=field('patient_id');const alertId=field('alert_id');const version=field('expected_version');const state=field('state');
  if (!UUID.test(patientId)||!UUID.test(alertId)||!/^[1-9]\d{0,8}$/.test(version)||(state!=='acknowledged'&&state!=='resolved')) return new Response('Invalid request',{status:422});
  const back=`/patients/${encodeURIComponent(patientId)}`;
  try {
    const response=await fetch(new URL(`/v1/doctor/patients/${encodeURIComponent(patientId)}/alerts/${encodeURIComponent(alertId)}`,process.env.RE_API_URL??'http://127.0.0.1:8000'),{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({expected_version:Number(version),state}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
    return NextResponse.redirect(new URL(response.ok?back:`${back}?error=alert-unavailable`,origin),303);
  } catch {return NextResponse.redirect(new URL(`${back}?error=alert-unavailable`,origin),303);}
}
