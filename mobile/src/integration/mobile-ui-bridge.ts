import type { Recommendation, ActivitySession } from './types';
export type BridgeApi = {recommendations:(session:string,limit:number)=>Promise<Recommendation>;start:(session:string,rec:Recommendation,id:string,channel:'voice'|'touch')=>Promise<ActivitySession>};
export class MobileUIBridge {
 recommendation:Recommendation|null=null;
 private presentationTail:Promise<void>=Promise.resolve();
 constructor(private api:BridgeApi,private sessionId:string,private render:(recommendation:Recommendation)=>Promise<void>,private launch:(activity:ActivitySession)=>void){}
 async present(limit=3){
  if(!Number.isInteger(limit)||limit<1||limit>3)throw new Error('Invalid recommendation limit');
  // Serialize presentations so concurrent tool callbacks cannot overwrite the
  // single pending UI commit acknowledgement and leave a provider tool hanging.
  return this.enqueue(()=>this.api.recommendations(this.sessionId,limit));
 }
 async presentExact(rec:Recommendation){ return this.enqueue(async()=>rec); }
 private enqueue(load:()=>Promise<Recommendation>){
  const result=this.presentationTail.then(async()=>{
   const rec=await load();
   this.recommendation=rec;
   await this.render(rec);
   return rec;
  });
  this.presentationTail=result.then(()=>{},()=>{});
  return result;
 }

 async select(id:string,channel:'voice'|'touch'){
  if(!this.recommendation?.options.some(o=>o.activity.activity_id===id))throw new Error('Stale activity selection');
  const activity=await this.api.start(this.sessionId,this.recommendation,id,channel);
  this.launch(activity);return activity;
 }
}
