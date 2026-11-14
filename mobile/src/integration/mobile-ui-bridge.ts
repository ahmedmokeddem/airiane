import type { Recommendation, ActivitySession } from './types';
export type BridgeApi = {recommendations:(session:string,limit:number)=>Promise<Recommendation>;start:(session:string,rec:Recommendation,id:string,channel:'voice'|'touch')=>Promise<ActivitySession>};
export class MobileUIBridge {
 recommendation:Recommendation|null=null;
 constructor(private api:BridgeApi,private sessionId:string,private render:(recommendation:Recommendation)=>Promise<void>,private launch:(activity:ActivitySession)=>void){}
 async present(limit=3){
  if(!Number.isInteger(limit)||limit<1||limit>3)throw new Error('Invalid recommendation limit');
  const rec=await this.api.recommendations(this.sessionId,limit);
  this.recommendation=rec;
  await this.render(rec); // Resolve provider callback only after React has committed these exact cards.
  return rec;
 }
 async select(id:string,channel:'voice'|'touch'){
  if(!this.recommendation?.options.some(o=>o.activity.activity_id===id))throw new Error('Stale activity selection');
  const activity=await this.api.start(this.sessionId,this.recommendation,id,channel);
  this.launch(activity);return activity;
 }
}
