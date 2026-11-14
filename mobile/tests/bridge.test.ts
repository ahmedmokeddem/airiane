import test from 'node:test';
import assert from 'node:assert/strict';
import fixture from '../../contracts/fixtures/recommendation.json';
import activity from '../../contracts/fixtures/activity-session.json';
import { MobileUIBridge } from '../src/integration/mobile-ui-bridge';
import { ElevenLabsAdapter } from '../src/integration/voice-agent-adapter';
import type { Recommendation, ActivitySession, Bootstrap } from '../src/integration/types';
const rec=fixture.data as Recommendation;
test('provider result waits for committed exact cards, then selection uses backend IDs',async()=>{
 let commit:()=>void=()=>{};let returned=false;let launched='';
 const bridge=new MobileUIBridge({recommendations:async(_session,limit)=>{assert.equal(limit,2);return rec;},start:async(_s,r,id,channel)=>{assert.equal(r.recommendation_id,rec.recommendation_id);assert.equal(id,rec.options[0].activity.activity_id);assert.equal(channel,'voice');return activity.data as ActivitySession;}},rec.session_id,async shown=>{assert.deepEqual(shown,rec);await new Promise<void>(resolve=>{commit=resolve;});},a=>{launched=a.activity_session_id;});
 const pending=bridge.present(2).then(r=>{returned=true;return r;});await new Promise(resolve=>setTimeout(resolve,0));assert.equal(returned,false);commit();assert.deepEqual(await pending,rec);await bridge.select(rec.options[0].activity.activity_id,'voice');assert.ok(launched);await assert.rejects(bridge.select('unknown','touch'),/Stale/);
});
test('voice adapter exposes no camera input and waits for actual provider connected event',async()=>{
 let options:Record<string,unknown>|undefined;
 const adapter=new ElevenLabsAdapter({startSession:o=>{options=o;},endSession:()=>{},sendUserMessage:()=>{},sendContextualUpdate:()=>{},setVolume:()=>{}},()=>{});
 const bootstrap={provider:'elevenlabs',camera_policy:'local_preview_only_no_transmission',mode:'voice',conversation_token:'fixture',agent_context:{vision_access:'none'}} as Bootstrap;
 const pending=adapter.connect(bootstrap);adapter.emit({type:'connected'});await pending;assert.deepEqual(options,{conversationToken:'fixture',connectionType:'webrtc'});assert.equal('camera' in adapter,false);assert.equal('sendFrame' in adapter,false);
});
test('mock accepted activity and feedback keep strict response shapes',async()=>{
 const {api}=await import('../src/integration/api');
 const s=await api.session('voice');const r=await api.recommendations(s.session_id,1);const started=await api.start(s.session_id,r,r.options[0].activity.activity_id,'touch');
 assert.equal('selection_channel' in started,false);assert.deepEqual(Object.keys(started).sort(),Object.keys(activity.data).sort());
 const completed=await api.complete(started,60,globalThis.crypto.randomUUID());await api.feedback(completed,r,4,globalThis.crypto.randomUUID());const journey=await api.journey();assert.equal(journey.items[0].feedback?.rating,4);assert.ok(journey.items[0].feedback?.source_id);
});

test('text sessions and voice/text switches never invoke unsupported audio controls',async()=>{
 const muted:boolean[]=[];const volumes:number[]=[];const options:Record<string,unknown>[]=[];
 const adapter=new ElevenLabsAdapter({startSession:o=>{options.push(o);},endSession:()=>{adapter.emit({type:'disconnected'});},sendUserMessage:()=>{},sendContextualUpdate:()=>{},setVolume:o=>{volumes.push(o.volume);}},value=>{muted.push(value);});
 const base={session_id:rec.session_id,connection_id:rec.session_id,connection_epoch:1,provider:'elevenlabs' as const,agent_id:'fixture',connect_before:'2099-01-01T00:00:00Z',credential_expires_at:null,privacy_policy_version:'fixture',camera_policy:'local_preview_only_no_transmission' as const,tool_contract_version:'2.0.0' as const,agent_context:{context_version:1,summary:'Fixture',guided_question:{question_id:null,flow_version:'fixture',wording:null,missing_fields:[],session_version:1},preferences:{},current_recommendation:null,active_activity_session:null,vision_access:'none' as const}};
 const connect=async(mode:'voice'|'text')=>{const bootstrap:Bootstrap=mode==='voice'?{...base,mode,transport:'webrtc',conversation_token:'fixture',provider_conversation_id:null}:{...base,mode,transport:'websocket',signed_url:'wss://example.invalid',text_only:true};const pending=adapter.connect(bootstrap);adapter.emit({type:'connected'});await pending;};
 adapter.setMicrophoneMuted(true);
 await connect('text');adapter.setMicrophoneMuted(true);adapter.setPlaybackVolume(0);
 assert.deepEqual(muted,[]);assert.deepEqual(volumes,[]);assert.equal(options[0].textOnly,true);
 await adapter.disconnect();await connect('voice');adapter.setMicrophoneMuted(true);adapter.setPlaybackVolume(0.5);
 assert.deepEqual(muted,[true]);assert.deepEqual(volumes,[0.5]);
 await adapter.disconnect();await connect('text');adapter.setMicrophoneMuted(false);adapter.setPlaybackVolume(1);
 assert.deepEqual(muted,[true]);assert.deepEqual(volumes,[0.5]);await adapter.disconnect();
});

test('saving an activity after voice disconnect does not call the closed provider',async()=>{
 const contexts:string[]=[];
 const adapter=new ElevenLabsAdapter({startSession:()=>{},endSession:()=>{adapter.emit({type:'disconnected'});},sendUserMessage:()=>{},sendContextualUpdate:t=>{contexts.push(t);},setVolume:()=>{}},()=>{});
 adapter.updateContext('saved while disconnected');assert.deepEqual(contexts,[]);
 const bootstrap={provider:'elevenlabs',camera_policy:'local_preview_only_no_transmission',mode:'voice',conversation_token:'fixture',agent_context:{vision_access:'none'}} as Bootstrap;
 const ready=adapter.connect(bootstrap);adapter.emit({type:'connected'});await ready;
 adapter.updateContext('accepted activity');assert.equal(contexts.at(-1),'accepted activity');
 await adapter.disconnect();const count=contexts.length;adapter.updateContext('accepted feedback');assert.equal(contexts.length,count);
});
