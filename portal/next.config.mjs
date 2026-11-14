import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const nextConfig = { allowedDevOrigins: ['127.0.0.1'], outputFileTracingRoot: path.resolve(directory, '..') };
export default nextConfig;
