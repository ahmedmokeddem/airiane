import { uuid } from './runtime';
import recommendationFixture from '../../../contracts/fixtures/recommendation.json';
import type { DTO, Session, Recommendation, ActivitySession, Journey } from './types';
export { uuid } from './runtime';
export const mode = process.env.EXPO_PUBLIC_API_MODE === 'live' ? 'live' : 'mock';
const origin = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';
if(typeof __DEV__!=='undefined'&&!__DEV__){
 if(process.env.EXPO_PUBLIC_APP_ENV!=='production'||mode!=='live'||process.env.EXPO_PUBLIC_DEMO_AUTH==='true'||process.env.EXPO_PUBLIC_VOICE_PROVIDER!=='elevenlabs'||!origin.startsWith('https://'))throw new Error('Configure the production HTTPS mobile environment before building a release.');
}
const eventBodies = new Map<string, DTO<'ActivityEventRequest'>>();
const feedbackBodies = new Map<string, DTO<'FeedbackRequest'>>();
let accessToken = '';
let mockJourney: Journey = {items:[],next_cursor:null};
const recommendation = recommendationFixture.data as Recommendation;
export function setAccessToken(value: string) { accessToken = value; }
export async function request<T>(path: string, body?: unknown, method = body ? 'POST' : 'GET', key: string = uuid()): Promise<T> {
  const response = await fetch(`${origin}/v1${path}`, {method, headers: {'Content-Type':'application/json', Authorization:`Bearer ${accessToken}`, ...(method==='GET'?{}:{'Idempotency-Key':key})}, body:body?JSON.stringify(body):undefined, signal:AbortSignal.timeout(30000)});
  if (!response.ok) { const error = await response.json().catch(()=>({code:'NETWORK_ERROR'})); throw new Error(`${error.code ?? response.status}: ${error.message ?? 'Please retry.'}`); }
  if(response.status===204)return undefined as T;
  return response.json() as Promise<T>;
}
export const api = {
  async session(kind:'voice'|'text'): Promise<Session> {
    if(mode==='mock') return {session_id:uuid(),state:'active',mode:kind,version:2,created_at:new Date().toISOString(),ended_at:null,history_enabled:false,current_connection_id:null};
    const created = await request<Session>('/conversation-sessions',{mode:kind});
    return request<Session>(`/conversation-sessions/${created.session_id}`,{state:'active',expected_version:created.version},'PATCH');
  },
  async recommendations(sessionId:string,limit=3):Promise<Recommendation> {return mode==='mock'?{...recommendation,session_id:sessionId}:request('/activity-recommendations',{session_id:sessionId,limit});},
  async start(sessionId:string, rec:Recommendation, activityId:string, channel:'voice'|'touch'):Promise<ActivitySession> {
    const selected=rec.options.find(o=>o.activity.activity_id===activityId);
    if(!selected)throw new Error('Activity is not in the current recommendation.');
    const body:DTO<'ActivityStart'>={session_id:sessionId,recommendation_id:rec.recommendation_id,activity_id:activityId,activity_version:selected.activity.activity_version,selection_channel:channel};
    const {selection_channel: _channel,...stored}=body;
    return mode==='mock'?{...stored,activity_session_id:uuid(),state:'started',version:1,started_at:new Date().toISOString(),ended_at:null}:request('/activity-sessions',body);
  },
  async complete(activity:ActivitySession,elapsed:number,key:string):Promise<ActivitySession> {
    let body=eventBodies.get(key);
    if(!body){body={client_event_id:key,expected_version:activity.version,event_type:'complete',elapsed_seconds:elapsed,event_at:new Date().toISOString()};eventBodies.set(key,body);}
    return mode==='mock'?{...activity,state:'completed',version:activity.version+1,ended_at:new Date().toISOString()}:request(`/activity-sessions/${activity.activity_session_id}/events`,body,'POST',key);
  },
  async feedback(activity:ActivitySession,rec:Recommendation|null,rating:number,key:string):Promise<void> {
    if(mode==='live'){let body=feedbackBodies.get(key);if(!body){body={rating,comment:null};feedbackBodies.set(key,body);}await request(`/activity-sessions/${activity.activity_session_id}/feedback`,body,'POST',key);return;}
    if(!rec)throw new Error('Mock feedback requires its recommendation.');
    const item=rec.options.find(o=>o.activity.activity_id===activity.activity_id)!;
    const feedback:DTO<'Feedback'>={feedback_id:uuid(),activity_session_id:activity.activity_session_id,rating,comment:null,source_id:uuid()};
    mockJourney={items:[{activity_session:activity,activity:item.activity,feedback},...mockJourney.items.filter(x=>x.activity_session.activity_session_id!==activity.activity_session_id)],next_cursor:null};
  },
  async journey():Promise<Journey>{return mode==='mock'?mockJourney:request('/my-journey');},
};

/** Authenticated binary transport. Credentials never enter a share URL. */
export async function reportPdfBytes(reportId:string):Promise<Uint8Array> {
 if(mode!=='live')throw new Error('PDF export requires a connected account.');
 const response=await fetch(`${origin}/v1/reports/${encodeURIComponent(reportId)}/pdf`,{headers:{Authorization:`Bearer ${accessToken}`,Accept:'application/pdf'},signal:AbortSignal.timeout(60000),redirect:'error'});
 if(!response.ok){const error=await response.json().catch(()=>({code:'EXPORT_FAILED'}));throw new Error(`${error.code ?? response.status}: Please refresh your report and retry.`);}
 if(!response.headers.get('content-type')?.startsWith('application/pdf'))throw new Error('The server did not return a PDF.');
 const bytes=new Uint8Array(await response.arrayBuffer());
 if(bytes.length>20*1024*1024||String.fromCharCode(...bytes.slice(0,4))!=='%PDF')throw new Error('The PDF response could not be verified.');
 return bytes;
}
