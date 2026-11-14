import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyReportFilters, insightRow, selectReports, wellbeingRow, type SharedReportRow } from '../lib/shared-reports';
import { loadSharedReportRows } from '../lib/shared-report-loader';
import type { DoctorPatient } from '../lib/types';
import type { InsightReportResponse } from '../lib/insight-types';

const alex:DoctorPatient={patient_id:'alex',display_name:'Alex (fictional)',care_link_id:'alex-link',scopes:['reports']};
const sam:DoctorPatient={patient_id:'sam',display_name:'Sam (fictional)',care_link_id:'sam-link',scopes:[]};
const a=wellbeingRow(alex,{report_id:'report-a',state:'ready',version:1,period_start:'2026-11-01T00:00:00Z',period_end:'2026-11-07T23:00:00Z',created_at:'2026-11-08T10:00:00Z'});
const b=wellbeingRow(sam,{report_id:'report-b',state:'stale',version:2,period_start:'2026-11-07T00:00:00Z',period_end:'2026-11-14T23:00:00Z',created_at:'2026-11-15T10:00:00Z'});
const unknown=wellbeingRow(alex,{report_id:'undated',state:'pending',version:1});
const filters=emptyReportFilters;

test('Report date sort uses timestamps and keeps unavailable dates last in both directions',()=>{
 assert.deepEqual(selectReports([unknown,a,b],filters,'createdAt','desc').map(r=>r.id),['report-b','report-a','undated']);
 assert.deepEqual(selectReports([unknown,a,b],filters,'createdAt','asc').map(r=>r.id),['report-a','report-b','undated']);
 assert.equal(unknown.createdAt,null);assert.equal(a.sharedAt,null);
});
test('Report filters combine patient identity, name or ID, type, status and overlapping date ranges',()=>{
 assert.deepEqual(selectReports([a,b],{...filters,search:'  aLeX  ',patient:'alex',kind:'wellbeing',status:'ready',from:'2026-11-07',to:'2026-11-07'},'patientName','asc').map(r=>r.id),['report-a']);
 assert.equal(selectReports([a,b],{...filters,search:'report-b'},'patientName','asc')[0].patientId,'sam');
 assert.equal(selectReports([a,b,unknown],{...filters,from:'2026-11-14'},'createdAt','desc').length,1);
 assert.deepEqual(selectReports([a,b],{...filters,from:'2026-11-15',to:'2026-11-01'},'createdAt','asc'),[]);
});
test('Receipt dates normalize to UTC and malformed or missing dates are never fabricated',()=>{
 const row=wellbeingRow(alex,{report_id:'offset',state:'ready',version:1,created_at:'2026-11-15T00:30:00+02:00',period_start:'broken'});
 assert.equal(row.createdAt,'2026-11-14T22:30:00.000Z');assert.equal(row.periodStart,null);
});
test('Report sorting is deterministic for equal dates and sorts displayed status labels',()=>{
 const rows=[{...a,id:'z'},{...a,id:'b'},{...a,id:'a'}];
 assert.deepEqual(selectReports(rows,filters,'createdAt','desc').map(r=>r.id),['a','b','z']);
 const shared={...a,id:'share',kind:'insight',status:'shared'} as SharedReportRow;
 assert.deepEqual(selectReports([shared,b],filters,'status','asc').map(r=>r.status),['stale','shared']);
});
const insight=(patient=alex):InsightReportResponse=>({
 report_id:'insight-a',patient_id:patient.patient_id,session_id:'session',status:'shared',schema_version:'conversation-insight/v1',created_at:'2026-11-14T10:00:00Z',shared_at:'2026-11-15T10:00:00Z',recipient_care_link_id:patient.care_link_id,
 report:{coverage:{period_start:'2026-11-13T10:00:00Z',period_end:'2026-11-14T10:00:00Z'},dimensions:[{evidence:[{quote:'Private quote must not reach the table'}]}]} as InsightReportResponse['report'],
});
test('Insight table projection carries only metadata and links to the exact patient report anchor',()=>{
 const row=insightRow(alex,insight());assert.equal(row.href,'/patients/alex#insight-insight-a');assert.equal(row.sharedAt,'2026-11-15T10:00:00.000Z');
 assert.equal(JSON.stringify(row).includes('Private quote'),false);
});
test('Report loader skips ordinary reports without a grant, rejects mismatched shares and isolates failed reads',async()=>{
 const requested:string[]=[];
 const result=await loadSharedReportRows({
  reports:async id=>{requested.push(id);throw new Error('permission revoked');},
  insightReports:async id=>({items:id==='alex'?[insight(),{...insight(),report_id:'private',status:'private_draft'},{...insight(),report_id:'other-link',recipient_care_link_id:'old-link'},{...insight(),report_id:'other-patient',patient_id:'someone-else'}]:[insight(sam)],next_cursor:null}),
 },[alex,sam]);
 assert.deepEqual(requested,['alex']);
 assert.deepEqual(result.rows.map(r=>r.patientId),['alex','sam']);
 assert.deepEqual(result.notices,[{patientId:'alex',patientName:alex.display_name,kind:'Wellbeing reports'}]);
});
test('Report loader preserves pagination signals without per-report document reads',async()=>{
 let reads=0;
 const result=await loadSharedReportRows({reports:async()=>{reads++;return {items:[{report_id:'a',state:'ready',version:1}],next_cursor:'opaque cursor'};},insightReports:async()=>({items:[],next_cursor:null})},[alex]);
 assert.equal(reads,1);assert.equal(result.moreReports[0].cursor,'opaque cursor');assert.equal(result.rows.length,1);
});
