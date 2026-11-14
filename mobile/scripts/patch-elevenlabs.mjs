// Version-guarded, idempotent SDK patch. Upstream: elevenlabs/packages#881.
// Run by npm ci/install and CI. No native dependency versions are changed.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../node_modules/@elevenlabs/react-native/', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
if (pkg.version !== '1.2.40') throw new Error('Review RE audio patch before changing ElevenLabs 1.2.40');
const target = new URL('dist/index.react-native.js', root);
const before = 'preferredOutputList: ["speaker"]';
const after = 'preferredOutputList: ["bluetooth", "headset", "earpiece", "speaker"]';
const source = readFileSync(target, 'utf8');
if (!source.includes(after)) {
  if (source.split(before).length !== 2) throw new Error('ElevenLabs routing source changed; patch review required');
  writeFileSync(target, source.replace(before, after));
}
console.log(`RE communication route patch verified: ${fileURLToPath(target).split('/node_modules/')[1]}`);
