import { NextResponse } from 'next/server';
import { validOrigin } from '@/lib/auth';
export async function POST(request: Request) {
  if (!validOrigin(request)) return new Response('Invalid origin',{status:403});
  const response=NextResponse.redirect(new URL('/login',request.headers.get('origin')!),303);
  response.cookies.set('re_access_token','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:0});
  response.headers.set('Cache-Control','no-store');return response;
}
