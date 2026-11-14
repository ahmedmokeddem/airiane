import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedInsightBody, MutationAttempt, parseInsightProposal } from '../src/features/insights/model';
const args={theme:'fatigue',text:'I felt tired today.',observed_at:'2026-11-14T08:00:00Z',statement_kind:'direct_statement'};
test('insight proposals reject model identity, invalid themes and unbounded text',()=>{
 assert.equal(parseInsightProposal(args).text,args.text);
 for(const invalid of [{...args,patient_id:'other'},{...args,session_id:'other'},{...args,confirmation:true},{...args,theme:'diagnosis'},{...args,text:'x'.repeat(501)},{...args,text:' '},{...args,observed_at:'today'},{...args,statement_kind:'confirmed'}])assert.throws(()=>parseInsightProposal(invalid));
});
test('explicit confirmation body uses app session and only approved fields',()=>{
 const proposal={...parseInsightProposal(args),proposal_id:'app-generated',session_id:'owned-session'};
 const body=approvedInsightBody(proposal,'Edited by the patient.');
 assert.equal(body.confirmation,true);assert.equal(body.session_id,'owned-session');assert.equal(body.text,'Edited by the patient.');assert.equal('proposal_id' in body,false);assert.equal('patient_id' in body,false);
});
test('retry keeps mutation identity for the identical approved body',()=>{
 const attempt=new MutationAttempt();let n=0;const allocate=()=>`key-${++n}`;
 assert.equal(attempt.prepare({text:'approved'},allocate),'key-1');
 assert.equal(attempt.prepare({text:'approved'},allocate),'key-1');
 assert.equal(attempt.prepare({text:'corrected'},allocate),'key-2');assert.equal(n,2);
});
