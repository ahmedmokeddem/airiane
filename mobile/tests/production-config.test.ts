import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {validateProductionMobile}=createRequire(import.meta.url)('../production-config.cjs');
test('production mobile configuration rejects local endpoints, demo mode and private keys',()=>{
 const config={EXPO_PUBLIC_APP_ENV:'production',EXPO_PUBLIC_API_MODE:'live',EXPO_PUBLIC_VOICE_PROVIDER:'elevenlabs',EXPO_PUBLIC_API_URL:'https://api.example.invalid',EXPO_PUBLIC_SUPABASE_URL:'https://auth.example.invalid',EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_fictional'};
 validateProductionMobile(config);
 for(const change of [{EXPO_PUBLIC_API_URL:'http://localhost:8000'},{EXPO_PUBLIC_DEMO_AUTH:'true'},{EXPO_PUBLIC_API_MODE:'mock'},{EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_secret_fixture'},{EXPO_PUBLIC_SUPABASE_ANON_KEY:'e30.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.fixture'}])assert.throws(()=>validateProductionMobile({...config,...change}));
});
