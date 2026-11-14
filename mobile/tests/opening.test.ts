import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { symbolSourceHash, symbolStrokes } from '../src/features/opening/symbol.generated';
import { openingTiming as t, shouldAnimateOpening } from '../src/features/opening/timing';

test('opening reveals the two approved SVG strokes byte-for-byte, never an invented morph', () => {
  const svg = readFileSync(new URL('../../assets/brand/logo/airiane-symbol.svg', import.meta.url),'utf8').replace(/\r\n/g,'\n');
  assert.equal(symbolSourceHash,createHash('sha256').update(svg).digest('hex'));
  assert.deepEqual(symbolStrokes.map(p=>p.d),[...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]));
  assert.ok(symbolStrokes.every(p=>p.length>100&&p.length<400));
});
test('opening budgets 2.5 seconds and skips motion for reduced motion or slow startup', () => {
  assert.equal(t.duration,2500);
  assert.equal(t.firstStart+t.firstDuration,t.secondStart);
  assert.equal(t.secondStart+t.secondDuration,t.endpoint);
  assert.ok(t.wordmark<t.fade&&t.fade<t.duration);
  assert.equal(shouldAnimateOpening(false,300),true);
  assert.equal(shouldAnimateOpening(true,300),false);
  assert.equal(shouldAnimateOpening(false,t.slowStartup),false);
});
