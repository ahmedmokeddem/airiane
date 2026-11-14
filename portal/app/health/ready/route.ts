export const dynamic='force-dynamic';
export async function GET(){
 try{const r=await fetch(new URL('/health/ready',process.env.RE_API_URL),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(4000)});if(!r.ok)throw new Error();return Response.json({status:'ready'},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({status:'not_ready'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
