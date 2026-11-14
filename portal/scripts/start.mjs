import {validateProduction} from '../lib/runtime-config.mjs';
validateProduction();
if(!/^\d+$/.test(process.env.PORT??'3000')||Number(process.env.PORT??3000)>65535||Number(process.env.PORT??3000)<1)throw new Error('Invalid PORT');
await import('../portal/server.js');
