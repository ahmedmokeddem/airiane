import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { validOrigin } from '@/lib/auth';
export async function POST(request: Request) {
  if (!validOrigin(request)) return new Response('Invalid origin',{status:403});
  const token=(await cookies()).get('re_access_token')?.value;
  if (!token) return NextResponse.redirect(new URL('/login',request.headers.get('origin')!),303);
  const id=String((await request.formData()).get('care_link_id')??'');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response('Invalid connection',{status:422});
  try {
    const response=await fetch(new URL(`/v1/care-links/${encodeURIComponent(id)}`,process.env.RE_API_URL??'http://127.0.0.1:8000'),{method:'PATCH',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify({action:'accept'}),cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});
    return NextResponse.redirect(new URL(response.ok?'/':'/?error=connection-unavailable',request.headers.get('origin')!),303);
  } catch {return NextResponse.redirect(new URL('/?error=connection-unavailable',request.headers.get('origin')!),303);}
}
