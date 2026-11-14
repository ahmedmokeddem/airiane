import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const nextConfig = { output: 'standalone', async headers(){return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'X-Frame-Options',value:'DENY'},{key:'Referrer-Policy',value:'no-referrer'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]}];}, allowedDevOrigins: ['127.0.0.1'], outputFileTracingRoot: path.resolve(directory, '..') };
export default nextConfig;
