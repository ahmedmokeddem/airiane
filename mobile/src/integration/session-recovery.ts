import type { Session } from './types';
/** An unknown open provider connection may belong to another device. Never take it over. */
export async function sessionForConnection(
  existing:Session|null,
  read:(id:string)=>Promise<Session>,
  create:()=>Promise<Session>,
):Promise<Session>{
 if (!existing) return create();
 const fresh=await read(existing.session_id);
 return fresh.state==='ended'||fresh.current_connection_id ? create() : fresh;
}
