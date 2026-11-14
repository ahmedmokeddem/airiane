import { sealSession } from '@/lib/session';
import { NextResponse } from 'next/server';
import { authenticate, validOrigin } from '@/lib/auth';
export async function POST(request: Request) {
  if (!validOrigin(request)) return new Response('Invalid origin', {status:403});
  try {
    const {token,expires} = await authenticate(await request.formData());
    const response = NextResponse.redirect(new URL('/',request.headers.get('origin')!),303);
    response.cookies.set('re_access_token',sealSession(token,expires),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:expires});
    response.headers.set('Cache-Control','no-store');return response;
  } catch {
    return NextResponse.redirect(new URL('/login?error=sign-in-failed',request.headers.get('origin')!),303);
  }
}
