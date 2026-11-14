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

