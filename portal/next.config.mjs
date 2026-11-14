import path from 'node:path';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const nextConfig = {
  // Required by portal/Dockerfile, which copies .next/standalone into the runtime image.
  output: 'standalone',
  distDir: process.env.PORTAL_BUILD_DIR || '.next',
  // Hides the dev-only "N" badge, which flashes "Rendering" on every live refresh.
  devIndicators: false,
  // Development only: lets a phone on the LAN or Tailscale load the dev server by the PC's address.
  allowedDevOrigins: ['127.0.0.1', '10.*.*.*', '192.168.*.*', '100.*.*.*'],
  outputFileTracingRoot: path.resolve(directory, '..'),
};
export default nextConfig;
