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

test('alert read uses clinician path, bearer, no-store and disallows redirects', async () => {
  let called = false;
  const fetcher: typeof fetch = async (input, init) => {
    called = true;
    assert.equal(String(input), 'http://127.0.0.1:8000/v1/doctor/patients/patient-id/alerts');
    assert.equal((init?.headers as Record<string,string>).Authorization, 'Bearer fictional-test-token');
    assert.equal(init?.cache, 'no-store'); assert.equal(init?.redirect, 'error');
    return Response.json({items:[],next_cursor:null});
  };
  const page = await new ClinicianApi('http://127.0.0.1:8000', 'fictional-test-token', fetcher).alerts('patient-id');
  assert.equal(called,true); assert.deepEqual(page.items,[]);
});

test('missing alert consent denies alerts without fallback data', async () => {
  const fetcher: typeof fetch = async () => new Response('', {status:403});
  await assert.rejects(new ClinicianApi('http://127.0.0.1:8000', 'fictional-test-token', fetcher).alerts('patient-id'), (error: unknown) => error instanceof ApiError && error.status === 403);
});

import fixture from '../fixtures/clinician.json';
import type { Report } from '../lib/types';
import { confirmedInsights, observationSeries, reportOverview } from '../lib/report-presentation';
test('report presentation excludes unconfirmed observations and unfinished participation', () => {
 const report = structuredClone(fixture.report) as Report;
 const observation = {observation_id:'o',patient_id:'p',session_id:null,kind:'mood' as const,value:5,observed_at:'2026-11-10T10:00:00Z',state:'confirmed' as const,version:1,supersedes_observation_id:null,sources:[]};
 report.observations = [observation, {...observation, observation_id:'proposed', state:'proposed'}, {...observation, observation_id:'rejected',state:'rejected'}];
 const result=reportOverview(report);assert.equal(result.confirmed.length,1);assert.equal(observationSeries(report)[0].points.length,1);
 report.completed_activities=report.completed_activities.map(item=>({...item,state:'started'}));assert.equal(reportOverview(report).completed.length,0);
});
test('observation series keeps real dates and values in chronological order without filling gaps',()=>{
 const report=structuredClone(fixture.report) as Report;
 const base={patient_id:'p',session_id:null,kind:'energy' as const,state:'confirmed' as const,version:1,supersedes_observation_id:null,sources:[]};
 report.observations=[{...base,observation_id:'later',value:7,observed_at:'2026-11-12T10:00:00Z'},{...base,observation_id:'earlier',value:2,observed_at:'2026-11-01T10:00:00Z'}];
 assert.deepEqual(observationSeries(report)[0].points.map(item=>[item.observation_id,item.value]),[['earlier',2],['later',7]]);
});
test('all protected clinician reads reject revoked permission with no fixture substitution',async()=>{
 const api=new ClinicianApi('http://127.0.0.1:8000','fictional',async()=>new Response('',{status:403}));
 for(const read of [()=>api.patients(),()=>api.reports('patient'),()=>api.report('patient','report')]) await assert.rejects(read,(error:unknown)=>error instanceof ApiError&&error.status===403);
});

test('report excludes superseded insights while preserving direct versus approved interpretation provenance',()=>{
 const report=structuredClone(fixture.report) as Report;
 const base={insight_id:'i',patient_id:'p',session_id:null,theme:'reflection' as const,text:'A patient confirmed reflection',observed_at:'2026-11-12T10:00:00Z',confirmed_at:'2026-11-12T10:01:00Z',statement_kind:'direct_statement' as const,version:1,state:'confirmed' as const,supersedes_insight_id:null,sources:[]};
 report.confirmed_insights=[base,{...base,insight_id:'old',state:'superseded'},{...base,insight_id:'approved',statement_kind:'patient_approved_interpretation'}];
 assert.deepEqual(confirmedInsights(report).map(item=>item.statement_kind),['direct_statement','patient_approved_interpretation']);
});

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AssessmentResults } from '../components/assessment-results';
test('questionnaire results show every band, the total, the action and the item-9 safety note',()=>{
 const report=structuredClone(fixture.report) as Report;
 const bands=[{min:0,max:9,level:'low' as const,label:'Minimal to mild depressive symptoms'},{min:10,max:14,level:'moderate' as const,label:'Moderate depressive symptoms'},{min:15,max:27,level:'high' as const,label:'Moderately severe to severe depressive symptoms'}];
 report.assessments=[{assessment_response_id:'r',assessment_id:'a',assessment_version:1,source_id:'s',complete:true,title:'PHQ-9 · Patient Health Questionnaire-9',answers:[{question_id:'q9',value:1}],observed_at:'2026-11-14T10:00:00Z',result:{instrument:'phq9',total:10,max_total:27,level:'moderate',severity:'Moderate depressive symptoms',suggested_action:'Recommend further assessment by a qualified therapist or mental health professional',interpretation:'The respondent reports a noticeable level of depressive symptoms.',bands,functional_impairment:'Somewhat difficult',domains:[],safety:{item_positive:true,follow_up:null},validated:true,note:'PHQ-9 is a validated screening questionnaire.'},answer_details:[{question_id:'q9',wording:'Thoughts that you would be better off dead or of hurting yourself in some way?',value:1,label:'Several days',scored:true},{question_id:'q10',wording:'If you checked off any problems, how difficult have these problems made it for you?',value:1,label:'Somewhat difficult',scored:false}]}];
 const html=renderToStaticMarkup(createElement(AssessmentResults,{report}));
 for(const text of ['<strong>10</strong> / 27','Moderate depressive symptoms','Recommend further assessment','Item 9 answered above 0','Every answer is listed below','Thoughts that you would be better off dead','<b>Several days</b>','not scored','<details open="">','0–9','10–14','15–27','Somewhat difficult','Validated questionnaire']) assert.ok(html.includes(text),text);
 assert.equal(renderToStaticMarkup(createElement(AssessmentResults,{report:{...report,assessments:[]}})),'');
});

test('the doctor client reads a questionnaire sent after a positive Q9 from the alert path',async()=>{
 let url='';const api=new ClinicianApi('http://127.0.0.1:8000','fictional',async input=>{url=String(input);return Response.json({});});
 await api.alertAssessment('patient-id','alert-id');
 assert.equal(url,'http://127.0.0.1:8000/v1/doctor/patients/patient-id/alerts/alert-id/assessment');
});

import {sealSession,openSession} from '../lib/session';
const testEnvironment=process.env as Record<string,string|undefined>;
test('production sessions are sealed, expire and reject tampering',()=>{
 const previous={env:testEnvironment.NODE_ENV,key:process.env.PORTAL_SESSION_KEY};
 try{testEnvironment.NODE_ENV='production';process.env.PORTAL_SESSION_KEY=Buffer.alloc(32,7).toString('base64');const sealed=sealSession('fictional-session-token',60);assert.ok(!sealed.includes('fictional-session-token'));assert.equal(openSession(sealed),'fictional-session-token');assert.equal(openSession(sealed.slice(0,-5)+'ABCDE'),undefined);assert.equal(openSession(sealSession('expired-fictional-token',-1)),undefined);assert.equal(openSession('unsealed-token'),undefined);}
 finally{if(previous.env===undefined)delete testEnvironment.NODE_ENV;else testEnvironment.NODE_ENV=previous.env;if(previous.key===undefined)delete process.env.PORTAL_SESSION_KEY;else process.env.PORTAL_SESSION_KEY=previous.key;}
});
test('production mutations require the configured public origin',()=>{
 const previous={env:testEnvironment.NODE_ENV,url:process.env.PORTAL_PUBLIC_URL};
 try{testEnvironment.NODE_ENV='production';process.env.PORTAL_PUBLIC_URL='https://portal.example.invalid';assert.equal(validOrigin(new Request('https://portal.example.invalid/care/accept',{headers:{origin:'https://attacker.example.invalid'}})),false);assert.equal(validOrigin(new Request('https://portal.example.invalid/care/accept',{headers:{origin:'https://portal.example.invalid'}})),true);}
 finally{if(previous.env===undefined)delete testEnvironment.NODE_ENV;else testEnvironment.NODE_ENV=previous.env;if(previous.url===undefined)delete process.env.PORTAL_PUBLIC_URL;else process.env.PORTAL_PUBLIC_URL=previous.url;}
});
test('directory and report pagination encode cursors without changing authorization',async()=>{
 const urls:string[]=[];const fetcher:typeof fetch=async(input,init)=>{urls.push(String(input));assert.equal(init?.cache,'no-store');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer fictional-token');return Response.json({items:[],next_cursor:null});};const api=new ClinicianApi('https://api.example.invalid','fictional-token',fetcher);await api.patients('cursor&patient=other');await api.reports('patient/id','cursor&report=other');assert.deepEqual(urls,['https://api.example.invalid/v1/doctor/patients?cursor=cursor%26patient%3Dother','https://api.example.invalid/v1/doctor/patients/patient%2Fid/reports?cursor=cursor%26report%3Dother']);
});
