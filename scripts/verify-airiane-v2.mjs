// Opt-in real-provider test; fictional data only; requires the isolated port-8011 backend.
import {TextConversation} from '../mobile/node_modules/@elevenlabs/client/dist/index.js';
import fs from 'node:fs';
const expectedAgentId=process.env.AIRIANE_V2_AGENT_ID;
if(!expectedAgentId)throw Error('Set AIRIANE_V2_AGENT_ID to the confirmed new agent ID.');
const origin='http://127.0.0.1:8011/v1';
const headers=()=>({'Content-Type':'application/json',Authorization:'Bearer demo-patient-token','Idempotency-Key':crypto.randomUUID()});
async function api(path,body,method=body?'POST':'GET'){
 const r=await fetch(origin+path,{method,headers:headers(),...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json();if(!r.ok)throw Error('Local fixture API '+path+' HTTP '+r.status+' '+data.code);return data;
}
const safety=await (await fetch('http://127.0.0.1:8011/health')).json();
if(safety.auth!=='fictional-demo'||safety.database!=='sqlite-development')throw Error('Refusing writes outside the isolated fictional SQLite backend.');
await api('/me/onboarding',{display_name:'Fictional V2 validation',timezone:'Europe/Helsinki'});
const state=await api('/companion');
if(state.daily_checkin.state==='available')await api('/companion/daily-checkin',{local_day:state.daily_checkin.local_day,expected_version:state.daily_checkin.version,decision:'decline'});
let app=await api('/conversation-sessions',{mode:'text'});app=await api('/conversation-sessions/'+app.session_id,{expected_version:app.version,state:'active'},'PATCH');
const sid=app.session_id;
let latestRecommendation=null;
const calls=[];
async function connect(){
 const fresh=await api('/conversation-sessions/'+sid);
 const b=await api('/conversation-sessions/'+sid+'/agent-connections',{mode:'text',expected_version:fresh.version});
 if(b.agent_id!==expectedAgentId)throw Error('Fixture backend is not using the expected V2 agent.');
 const base='/conversation-sessions/'+sid+'/agent-connections/'+b.connection_id;
 let connection=await api(base,{state:'connecting',expected_version:1},'PATCH');
 let replyResolve,replyReject;let errors=[];
 const context={...b.agent_context,application_time:new Date().toISOString()};
 const c=await TextConversation.startSession({signedUrl:b.signed_url,textOnly:true,connectionType:'websocket',dynamicVariables:{application_context:JSON.stringify(context)},
  clientTools:{
   get_patient_context:async()=>{calls.push('get_patient_context');return JSON.stringify(await api('/patient-context'));},
   get_next_guided_question:async()=>{calls.push('get_next_guided_question');return JSON.stringify(await api('/conversation-sessions/'+sid+'/guided-question'));},
   present_activity_recommendations:async args=>{calls.push('present_activity_recommendations');latestRecommendation=await api('/activity-recommendations',{session_id:sid,limit:Number(args.limit)});return JSON.stringify(latestRecommendation);},
   select_activity:async args=>{calls.push('select_activity');return JSON.stringify(await api('/activity-sessions',{session_id:sid,...args,selection_channel:'voice'}));},
   propose_conversation_insight:async()=>{calls.push('propose_conversation_insight');return JSON.stringify({persisted:false,state:'awaiting_patient_review',proposal_id:crypto.randomUUID()});},
  },
  onMessage:m=>{if(m.source==='ai'&&replyResolve){const done=replyResolve;replyResolve=null;done(m.message);}},
  onError:e=>{errors.push(String(e));replyReject?.(Error('Provider conversation error'));},
 });
 connection=await api(base,{state:'active',expected_version:connection.version},'PATCH');
 return {context,async send(text){return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Provider reply timeout')),35000);replyResolve=value=>{clearTimeout(timer);resolve(value);};replyReject=reject;c.sendUserMessage(text);});},async close(){await c.endSession();await api(base,{state:'closed',expected_version:connection.version},'PATCH');},errors};
}
const receipt={fictional_data_only:true,real_provider:true,real_local_backend:true,device_test:false,ui_cards_rendered_on_device:false,checks:[]};
let c=await connect();
try{
 const answer=await c.send('Tell me one short playful sentence about a fox wearing a tiny hat. No wellbeing questions, please.');
 receipt.checks.push({scenario:'casual_chat',response_received:!!answer,forced_activity:calls.includes('present_activity_recommendations'),forced_note:calls.includes('propose_conversation_insight')});
 console.log('First real-provider reply received; no patient content retained.');
}finally{await c.close();}
c=await connect();
try{
 const answer=await c.send('Hi again. Another short silly fox sentence, please.');
 receipt.checks.push({scenario:'returning_reconnection',relationship:c.context.companion_context.relationship_status,response_received:!!answer,self_introduction:/\b(?:I['’]?m|I am|my name is)\s+AIriane/i.test(answer),daily_invitation_allowed:c.context.companion_context.daily_checkin.invitation_allowed});
 console.log('Returning conversation replied; introduction check recorded.');
 const answer2=await c.send('I would like to try a relaxing activity now. Please show the available activity cards.');
 await new Promise(resolve=>setTimeout(resolve,5000));
 receipt.activity_first_reply_leaked_tool_markup=/<tool_code>|print\(|present_activity_recommendations\(/i.test(answer2);receipt.activity_tool_called_without_followup=!!latestRecommendation;
 if(!latestRecommendation){await c.send('Yes, show the real available choices now, please.');await new Promise(resolve=>setTimeout(resolve,5000));}
 receipt.checks.push({scenario:'activity_request',response_received:!!answer2,recommendation_tool_called:calls.includes('present_activity_recommendations'),backend_generated_recommendation:!!latestRecommendation?.recommendation_id,backend_generated_option_ids:latestRecommendation?.options?.every(x=>!!x.activity.activity_id)??false});
}finally{await c.close();}
// Explicit fictional patient confirmation and opt-in, never real patient data.
await api('/confirmed-insights',{session_id:sid,theme:'reflection',text:'I enjoy stories about imaginary foxes.',observed_at:new Date().toISOString(),statement_kind:'direct_statement',confirmation:true});
let memory=await api('/companion');
await api('/companion',{memory_enabled:true,expected_version:memory.version},'PATCH');
c=await connect();
try{
 const answer=await c.send('What kind of stories did I say I enjoy?');
 receipt.checks.push({scenario:'approved_memory_after_reconnect',approved_notes_loaded:c.context.companion_context.confirmed_notes.length>0,grounded_recall:/fox/i.test(answer)});
}finally{await c.close();}
memory=await api('/companion');
await api('/companion',{memory_enabled:false,expected_version:memory.version},'PATCH');
c=await connect();
try{
 const answer=await c.send('What kind of stories did I say I enjoy?');
 receipt.checks.push({scenario:'memory_opt_out_after_reconnect',notes_empty:c.context.companion_context.confirmed_notes.length===0,previous_preference_not_claimed:!/fox/i.test(answer)});
}finally{await c.close();}
receipt.tool_calls=calls;
fs.writeFileSync('/tmp/airiane-v2-provider-smoke-result.json',JSON.stringify(receipt,null,2));
console.log(JSON.stringify(receipt));

const failures=receipt.checks.filter(c=>c.forced_activity||c.forced_note||c.self_introduction||c.response_received===false||c.recommendation_tool_called===false||c.backend_generated_recommendation===false||c.backend_generated_option_ids===false||c.approved_notes_loaded===false||c.grounded_recall===false||c.notes_empty===false||c.previous_preference_not_claimed===false);
if(failures.length||receipt.activity_first_reply_leaked_tool_markup||!receipt.activity_tool_called_without_followup)throw Error('V2 smoke assertions failed; inspect the boolean receipt.');
