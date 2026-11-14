const {Buffer}=require('node:buffer');
function validateProductionMobile(env){
 if(env.EXPO_PUBLIC_APP_ENV!=='production')return;
 if(env.EXPO_PUBLIC_API_MODE!=='live'||env.EXPO_PUBLIC_VOICE_PROVIDER!=='elevenlabs'||env.EXPO_PUBLIC_DEMO_AUTH==='true')throw new Error('Production mobile requires live API, ElevenLabs and disabled demo auth.');
 for(const key of ['EXPO_PUBLIC_API_URL','EXPO_PUBLIC_SUPABASE_URL']){
  let url;try{url=new URL(env[key]??'');}catch{throw new Error(`Missing ${key}`);}
  if(url.protocol!=='https:'||['localhost','127.0.0.1','::1'].includes(url.hostname)||url.username||url.password)throw new Error(`${key} requires a public HTTPS URL.`);
 }
 const key=env.EXPO_PUBLIC_SUPABASE_ANON_KEY??'';
 if(!key||key.startsWith('sb_secret_'))throw new Error('Use a Supabase publishable/anon key, never a secret key.');
 if(!key.startsWith('sb_publishable_')){
  let claims;try{claims=JSON.parse(Buffer.from(key.split('.')[1]??'','base64url').toString());}catch{throw new Error('Use a valid Supabase publishable or legacy anon key.');}
  if(claims.role!=='anon')throw new Error('Only a public anon key may be bundled.');
 }
}
module.exports={validateProductionMobile};
