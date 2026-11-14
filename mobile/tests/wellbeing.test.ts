import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fixture from '../../contracts/fixtures/recommendation.json';
import { activityCue, type ActivityDetail } from '../src/features/activity/activity-cues';
import { AudioTherapySynthesizer, describeSoundscape } from '../src/features/activity/audio-therapy';
import { confirmedOn, pending, stepValue } from '../src/features/checkin/checkin-state';

const breathing = fixture.data.options[0].activity as ActivityDetail;
const config = (renderer: ActivityDetail['config']['renderer'], instructions: string[]) => ({ renderer, asset_id: null, instructions, inhale_seconds: null, exhale_seconds: null });

test('activity cues use the catalog title and renderer-specific prompts', () => {
  assert.equal(activityCue(breathing, 0).title, 'Calm Breathing');
  assert.equal(activityCue(breathing, 0).cue, 'Breathe in gently');
  assert.equal(activityCue(breathing, 4).cue, 'Breathe out slowly');
  const resonance: ActivityDetail = { ...breathing, kind: 'nature', title: '40 Hz Acoustic Resonance', config: config('nature_v1', ['Settle', 'Listen', 'Stop anytime']) };
  assert.equal(activityCue(resonance, 0).title, '40 Hz Acoustic Resonance');
  assert.deepEqual([0, 20, 40, 60].map(t => activityCue(resonance, t).cue), ['Settle', 'Listen', 'Stop anytime', 'Stop anytime']);
  assert.ok(activityCue(resonance, 3).pulse > activityCue(resonance, 0).pulse);
  const grounding: ActivityDetail = { ...breathing, kind: 'behavioral_activation', title: '5-Sense Room Grounding', config: config('step_v1', ['See', 'Hear', 'Feel']) };
  assert.equal(activityCue(grounding, 45).cue, 'Feel');
  assert.notEqual(activityCue(grounding, 0).symbol, activityCue(breathing, 0).symbol);
  // An unloaded catalog row never crashes or invents a title.
  assert.equal(activityCue(null, 10).duration, 60);
});

test('check-in steps stay inside each scale and use API-safe increments', () => {
  assert.equal(stepValue(10, 1, 10, 1), 10); assert.equal(stepValue(0, -1, 10, 1), 0);
  assert.equal(stepValue(7, 1, 24, 0.5), 7.5); assert.equal(stepValue(24, 1, 24, 0.5), 24);
});

test('only explicitly confirmed observations count; proposals wait for the patient', async () => {
  const { api } = await import('../src/integration/api');
  const proposed = await api.proposeObservation('mood', 6);
  assert.equal(proposed.state, 'proposed'); assert.deepEqual(proposed.sources, []);
  assert.deepEqual(confirmedOn(await api.observations(), new Date()), {});
  assert.equal(pending(await api.observations()).length, 1);
  const confirmed = await api.decideObservation(proposed, 'confirm');
  assert.equal(confirmed.state, 'confirmed'); assert.equal(confirmed.version, 2);
  const rejected = await api.decideObservation(await api.proposeObservation('energy', 2), 'reject');
  assert.equal(rejected.state, 'rejected');
  const today = confirmedOn(await api.observations(), new Date());
  assert.equal(today.mood?.value, 6); assert.equal(today.energy, undefined);
  assert.equal(pending(await api.observations()).length, 0);
});

test('check-in and review request never touch camera or claim automatic measurement', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const checkIn = read('../src/features/checkin/daily-check-in.tsx');
  assert.ok(!/expo-camera|CameraView|use-local-camera/.test(checkIn));
  assert.ok(checkIn.includes('nothing is measured automatically'));
  assert.ok(read('../src/features/reports/reports-sharing.tsx').includes('This is not an emergency service'));
});

test('audio therapy synthesizer maps each activity to its therapeutic soundscape and controls playback', () => {
  const resonance: ActivityDetail = { ...breathing, kind: 'nature', title: '40 Hz Acoustic Resonance', config: { ...config('nature_v1', ['Settle', 'Listen']), asset_id: 'soundscape-40hz-v1' } };
  const goodNews: ActivityDetail = { ...breathing, kind: 'social_reconnection', title: 'Daily Good News Digest', config: { ...config('social_v1', ['Espoo solar library hits record', 'Saimaa seal pups thrive']), asset_id: 'good-news-ambient-v1' } };
  const grounding: ActivityDetail = { ...breathing, kind: 'behavioral_activation', title: '5-Sense Room Grounding', config: { ...config('step_v1', ['See', 'Hear', 'Feel']), asset_id: 'grounding-chime-v1' } };

  const resProfile = describeSoundscape(resonance);
  assert.equal(resProfile.binauralBeatHz, 40);
  assert.equal(resProfile.modulationHz, 40);
  assert.equal(resProfile.ambientNoise, true);
  assert.deepEqual(resProfile.frequenciesHz, [120, 200, 240]);

  const newsProfile = describeSoundscape(goodNews);
  assert.equal(newsProfile.id, 'good-news-ambient-v1');
  assert.equal(activityCue(goodNews, 0).symbol, '♡');
  assert.equal(activityCue(goodNews, 0).cue, 'Espoo solar library hits record');
  assert.equal(activityCue(goodNews, 40).cue, 'Saimaa seal pups thrive');

  const groundProfile = describeSoundscape(grounding);
  assert.equal(groundProfile.stepChimeHz, 528);

  const synth = new AudioTherapySynthesizer();
  assert.equal(synth.running, false);
  synth.start(resonance);
  assert.equal(synth.running, true);
  assert.equal(synth.profileId, 'soundscape-40hz-v1');
  synth.setMuted(true);
  assert.equal(synth.muted, true);
  synth.syncElapsed(resonance, 15);
  synth.stop();
  assert.equal(synth.running, false);
});


test('on native the soundscape loops a bundled asset through a real player, not the Web Audio API', () => {
  type FakePlayer = {
    source: unknown; loop: boolean; muted: boolean; volume: number;
    plays: number; removes: number; play(): void; pause(): void; remove(): void;
  };
  const players: FakePlayer[] = [];
  let audioModeCalls = 0;
  const backend = {
    createPlayer(source: number | string | { uri: string }) {
      const player: FakePlayer = {
        source, loop: false, muted: false, volume: 1, plays: 0, removes: 0,
        play() { this.plays++; }, pause() {}, remove() { this.removes++; },
      };
      players.push(player);
      return player;
    },
    configureAudioMode() { audioModeCalls++; },
  };
  const nativeAssets = {
    'nordic_forest_birds.mp3': 11,
    'gentle_rain.mp3': 44,
    'gentle-rain-stream.wav': 22,
    'bilateral-grounding-chimes.wav': 33,
  };
  const synth = new AudioTherapySynthesizer({ platform: 'native', nativeBackend: backend, nativeAssets });
  const nature: ActivityDetail = {
    ...breathing, kind: 'nature', title: '40 Hz Acoustic Resonance',
    config: { ...config('nature_v1', ['Settle', 'Listen']), asset_id: 'soundscape-40hz-v1' },
  };

  synth.start(nature);
  assert.equal(players.length, 1);
  assert.equal(players[0].source, 11);      // default switcher choice, from assets/audio
  assert.equal(players[0].loop, true);
  assert.equal(players[0].plays, 1);
  assert.equal(audioModeCalls, 1);

  // The hook re-calls start() every elapsed tick; the loop must not restart.
  synth.start(nature);
  synth.start(nature, { bilateral: false });
  assert.equal(players.length, 1);

  synth.setMuted(true);
  assert.equal(players[0].muted, true);
  synth.setMuted(false);
  assert.equal(players[0].muted, false);

  // Switching the soundscape swaps the file and releases the previous player.
  synth.start(nature, { soundscape: 'gentle_rain' });
  assert.equal(players.length, 2);
  assert.equal(players[1].source, 44);
  assert.equal(players[0].removes, 1);

  // `harmonic-breath-v1` is absent from assets/audio/manifest.json: breathing
  // must still get an audible bundled loop.
  synth.start(breathing);
  assert.equal(players.length, 3);
  assert.equal(players[2].source, 22);
  assert.equal(players[2].loop, true);
  assert.equal(audioModeCalls, 1);          // configured once per synthesizer

  synth.stop();
  assert.equal(synth.running, false);
  assert.equal(players[2].removes, 1);
});

test('chat check-in reads spoken or typed answers and never guesses', async () => {
  const { parseAnswer, missingToday } = await import('../src/features/checkin/checkin-state');
  assert.equal(parseAnswer('mood', 'about a 6 today'), 6);
  assert.equal(parseAnswer('mood', '6/10'), 6);
  assert.equal(parseAnswer('energy', 'maybe three'), 3);
  assert.equal(parseAnswer('sleep_hours', '7.5 hours'), 7.5);
  assert.equal(parseAnswer('sleep_hours', 'seven and a half'), 7.5);
  assert.equal(parseAnswer('sleep_hours', '6,5'), 6.5);
  // Out of scale or no number: ask again rather than invent a value.
  assert.equal(parseAnswer('mood', 'eleven'), null);
  assert.equal(parseAnswer('mood', 'not great honestly'), null);
  assert.equal(parseAnswer('sleep_hours', '30'), null);
  assert.deepEqual(missingToday([], new Date()), ['mood', 'energy', 'sleep_hours']);
});

test('the companion asks the next unanswered question until today is complete', async () => {
  const { api } = await import('../src/integration/api');
  const session = await api.session('text');
  // Earlier tests in this file confirmed mood for today; energy was rejected.
  let next = await api.nextCheckInQuestion(session.session_id);
  assert.equal(next.kind, 'energy'); assert.ok(next.wording);
  await api.decideObservation(await api.proposeObservation('energy', 4), 'confirm');
  await api.decideObservation(await api.proposeObservation('sleep_hours', 7), 'confirm');
  next = await api.nextCheckInQuestion(session.session_id);
  assert.deepEqual(next, { kind: null, wording: null });
});

test('home check-in is a status card, not a manual form', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const card = read('../src/features/checkin/daily-check-in.tsx');
  assert.ok(!/stepValue|check-in-\$\{f\.kind\}-more/.test(card));
  assert.ok(read('../src/features/checkin/check-in-proposals.tsx').includes("decide(o, 'confirm')"));
});
