// Real FastAPI + real database, simulated agent invocation. No provider credentials or media.
import assert from 'node:assert/strict';
import { api, setAccessToken, request, uuid } from '../src/integration/api';
import { MobileUIBridge } from '../src/integration/mobile-ui-bridge';
import type { ActivitySession } from '../src/integration/types';
async function main(){
 assert.equal(process.env.EXPO_PUBLIC_API_MODE,'live','Set EXPO_PUBLIC_API_MODE=live for this test');
 setAccessToken('demo-patient-token');
 await request('/me/onboarding',{display_name:'Fictional integration patient',timezone:'Europe/Helsinki'});
 const session=await api.session('voice');let rendered:string[]=[];let selected:ActivitySession|null=null;
 const bridge=new MobileUIBridge(api,session.session_id,async rec=>{rendered=rec.options.map(x=>x.activity.activity_id);},activity=>{selected=activity;});
 const spoken=await bridge.present(1);assert.deepEqual(spoken.options.map(o=>o.activity.activity_id),rendered);
 await bridge.select(rendered[0],'voice');assert.ok(selected);
 const completed=await api.complete(selected!,60,uuid());await api.feedback(completed,spoken,4,uuid());
 const journey=await api.journey();assert.ok(journey.items.some(item=>item.activity_session.activity_session_id===completed.activity_session_id&&item.activity_session.state==='completed'&&item.feedback?.rating===4));
 console.log('PASS: simulated tool → real FastAPI cards → voice selection → completion/feedback → persisted My Journey');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
