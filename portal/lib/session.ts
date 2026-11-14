import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
function key(){const value=Buffer.from(process.env.PORTAL_SESSION_KEY??'','base64');if(value.length!==32)throw new Error('Session encryption is not configured.');return value;}
export function sealSession(token:string,expires:number):string{
 if(process.env.NODE_ENV!=='production')return token;
 const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);
 const content=Buffer.from(JSON.stringify({token,exp:Date.now()+expires*1000}));
 const ciphertext=Buffer.concat([cipher.update(content),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),ciphertext.toString('base64url')].join('.');
}
export function openSession(value:string|undefined):string|undefined{
 if(process.env.NODE_ENV!=='production')return value;
 if(!value)return;
 try{const [version,iv,tag,body]=value.split('.');if(version!=='v1')return;const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64url'));decipher.setAuthTag(Buffer.from(tag,'base64url'));const session=JSON.parse(Buffer.concat([decipher.update(Buffer.from(body,'base64url')),decipher.final()]).toString());if(session.exp<=Date.now()||typeof session.token!=='string')return;return session.token;}catch{return;}
}
