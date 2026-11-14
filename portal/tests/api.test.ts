import assert from 'node:assert/strict';
import test from 'node:test';
import { ClinicianApi, ApiError } from '../lib/api';

test('report read uses clinician path, bearer, no-store and disallows redirects', async () => {
  let called = false;
  const fetcher: typeof fetch = async (input, init) => {
    called = true;
    assert.equal(String(input), 'http://127.0.0.1:8000/v1/doctor/patients/patient-id/reports/report-id');
    assert.equal((init?.headers as Record<string,string>).Authorization, 'Bearer fictional-test-token');
    assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error');
    return Response.json({report_id:'report-id'});
  };
  await new ClinicianApi('http://127.0.0.1:8000', 'fictional-test-token', fetcher).report('patient-id','report-id');
  assert.equal(called,true);
});

test('revocation denies report without returning cached or fictional fallback data', async () => {
  const fetcher: typeof fetch = async () => new Response('', {status:403});
  await assert.rejects(new ClinicianApi('http://127.0.0.1:8000', 'fictional-test-token', fetcher).report('patient-id','report-id'), (error: unknown) => error instanceof ApiError && error.status === 403);
});

test('pending report is explicit and does not pretend a report exists', async () => {
  const fetcher: typeof fetch = async () => new Response('', {status:409});
  await assert.rejects(new ClinicianApi('http://127.0.0.1:8000', 'fictional-test-token', fetcher).report('patient-id','report-id'), (error: unknown) => error instanceof ApiError && error.status === 409);
});

import { authenticate, validOrigin } from '../lib/auth';
test('clinician login validates backend role before a session can be created',async()=>{
 const oldUrl=process.env.RE_SUPABASE_URL;const oldKey=process.env.RE_SUPABASE_ANON_KEY;
 process.env.RE_SUPABASE_URL='https://example.invalid';process.env.RE_SUPABASE_ANON_KEY='fictional-public-key';
 const form=new FormData();form.set('email','fictional@example.invalid');form.set('password','fictional-password');
 let calls=0;
 try{
  const fetcher:typeof fetch=async(input,init)=>{calls++;assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'error');return String(input).includes('/auth/v1/token')?Response.json({access_token:'fictional-token',expires_in:3600}):Response.json({role:'patient',clinician_verified:false});};
  await assert.rejects(authenticate(form,fetcher),/verified clinician/);assert.equal(calls,2);
 }finally{if(oldUrl===undefined)delete process.env.RE_SUPABASE_URL;else process.env.RE_SUPABASE_URL=oldUrl;if(oldKey===undefined)delete process.env.RE_SUPABASE_ANON_KEY;else process.env.RE_SUPABASE_ANON_KEY=oldKey;}
});
test('session mutation rejects cross-origin requests',()=>{
 assert.equal(validOrigin(new Request('https://portal.example/auth/logout',{method:'POST',headers:{origin:'https://other.example'}})),false);
 assert.equal(validOrigin(new Request('https://portal.example/auth/logout',{method:'POST',headers:{origin:'https://portal.example'}})),true);
});

test('same-origin checks support the development server internal hostname',()=>{assert.equal(validOrigin(new Request('http://localhost:3000/auth/login',{method:'POST',headers:{origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000'}})),true);});
