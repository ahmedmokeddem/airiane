/** Explicit export actions; a download never invokes another application's share UI. */
export type ExportPorts={download:()=>Promise<string>;save:(uri:string)=>Promise<void>;share:(uri:string)=>Promise<void>};
export class ExportController{
 private uri:string|null=null;
 private pending=false;
 private expiresAt=0;
 constructor(private readonly ports:ExportPorts, private readonly clock:()=>number=Date.now){}
 get ready(){return this.uri!==null;}
 async execute(action:'download'|'save'|'share'){
  if(this.pending)return;
  this.pending=true;
  try{
   if(action==='download'){this.uri=null;this.uri=await this.ports.download();this.expiresAt=this.clock()+15*60*1000;return;}
   if(this.uri&&this.clock()>=this.expiresAt){this.uri=null;throw new Error('The temporary copy expired. Export your report again.');}
   if(!this.uri)throw new Error('Export your report first.');
   await this.ports[action](this.uri);
  }finally{this.pending=false;}
 }
}
