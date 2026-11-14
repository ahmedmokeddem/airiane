export function validateProduction(env=process.env){
 if(env.NODE_ENV!=='production')return;
 if(env.PORTAL_DATA_MODE!=='api'||env.PORTAL_DEMO_AUTH==='true')throw new Error('Production requires PORTAL_DATA_MODE=api and disabled demo authentication.');
 for(const key of ['RE_API_URL','RE_SUPABASE_URL','PORTAL_PUBLIC_URL']){
  let url;try{url=new URL(env[key]??'');}catch{throw new Error(`Missing or invalid ${key}`);}
  if(url.protocol!=='https:'||!url.hostname||['localhost','127.0.0.1','::1'].includes(url.hostname)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error(`${key} must be an HTTPS origin.`);
 }
 const publicKey=env.RE_SUPABASE_ANON_KEY??'';
 if(!publicKey.startsWith('sb_publishable_')){
  let claims;try{claims=JSON.parse(Buffer.from(publicKey.split('.')[1]??'','base64url').toString());}catch{throw new Error('RE_SUPABASE_ANON_KEY requires a publishable or legacy anon key.');}
  if(claims.role!=='anon')throw new Error('A private Supabase key is not permitted here.');
 }
 if(!env.PORTAL_SESSION_KEY||Buffer.from(env.PORTAL_SESSION_KEY,'base64').length!==32)throw new Error('PORTAL_SESSION_KEY must encode 32 random bytes.');
}
