import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSpeechGate, WORKLET_SOURCE, type NoiseFilterMode } from '../src/features/call/speech-gate';

// 48 kHz audio in 128-sample blocks, as the AudioWorklet delivers it.
const RATE = 48000, BLOCK = 128, BLOCKS_PER_SECOND = RATE / BLOCK;
type Segment = [seconds: number, levelDb: number];
/** Feed levels (dBFS) through a fresh gate; return the gain after every block. */
function run(segments: Segment[], mode: NoiseFilterMode = 'standard') {
  const gate = createSpeechGate(RATE, BLOCK, mode);
  const gains: number[] = [];
  for (const [seconds, level] of segments)
    for (let i = 0; i < Math.round(seconds * BLOCKS_PER_SECOND); i++) gains.push(gate.step(level));
  return { gate, gains };
}
const at = (seconds: number) => Math.round(seconds * BLOCKS_PER_SECOND) - 1;
const QUIET = -65, PATIENT = -24, FAR_VOICE = -42, TV = -40;

test('keeps the microphone open while learning the room, then turns down silence', () => {
  const { gains } = run([[3, QUIET]]);
  assert.equal(gains[at(0.9)], 1);
  assert.ok(gains[at(3)] < 0.2, `quiet room gain ${gains[at(3)]}`);
});

test('opens within milliseconds for the patient and holds through pauses between words', () => {
  const { gains } = run([[2, QUIET], [0.02, PATIENT], [1.5, PATIENT], [0.2, QUIET], [1, PATIENT]]);
  assert.ok(gains[at(2.02)] > 0.95, 'opens within 20 ms');
  assert.ok(Math.min(...gains.slice(at(2.02), at(4.72))) > 0.95, 'stays open through a 200 ms pause');
});

test('stays open during a long monologue instead of learning the voice as noise', () => {
  const { gains } = run([[2, QUIET], [30, PATIENT]]);
  assert.ok(Math.min(...gains.slice(at(2.05))) > 0.95);
});

test('turns down a quieter voice further away once the patient has spoken', () => {
  const { gains } = run([[2, QUIET], [3, PATIENT], [1, QUIET], [3, FAR_VOICE]]);
  assert.ok(gains[at(9)] < 0.2, `far voice gain ${gains[at(9)]}`);
});

test('treats a TV that was already on as background, but still hears the patient', () => {
  const { gains } = run([[2, TV], [2, TV], [1.5, PATIENT]]);
  assert.ok(gains[at(4)] < 0.2, `TV gain ${gains[at(4)]}`);
  assert.ok(gains[at(5.5)] > 0.95, 'patient over the TV');
});

test('strong mode reduces background further than standard', () => {
  const room: Segment[] = [[2, QUIET], [3, PATIENT], [1, QUIET], [3, FAR_VOICE]];
  assert.ok(run(room, 'strong').gains[at(9)] < run(room, 'standard').gains[at(9)]);
});

test('one loud bang cannot leave the gate deaf to normal speech for long', () => {
  const { gains } = run([[2, QUIET], [2, PATIENT], [0.4, -3], [12, QUIET], [1, PATIENT]]);
  assert.ok(gains[at(17.4)] > 0.95, `gain after recovery ${gains[at(17.4)]}`);
});

test('off is a pass-through and can be switched live', () => {
  assert.ok(run([[2, QUIET], [3, FAR_VOICE]], 'off').gains.every(g => g === 1));
  const { gate } = run([[3, QUIET]]);
  gate.setMode('off');
  assert.equal(gate.step(QUIET), 1);
  assert.equal(gate.state().mode, 'off');
});

test('the audio-thread code is valid JavaScript and fails open when filtering is unavailable', () => {
  assert.doesNotThrow(() => new Function(WORKLET_SOURCE));
  assert.ok(WORKLET_SOURCE.includes("registerProcessor('speech-gate'"));
  const web = readFileSync(new URL('../src/features/call/noise-filter.ts', import.meta.url), 'utf8');
  assert.ok(web.includes("if (ctx.state !== 'running') return raw;"));
  assert.ok(web.includes('constraints.video) return raw;'), 'camera requests are never processed');
  const native = readFileSync(new URL('../src/features/call/noise-filter.native.ts', import.meta.url), 'utf8');
  assert.ok(native.includes('noiseFilterSupported = false'));
});
