import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextCompanionState, preferredRoute } from '../src/features/call/call-state';
import { ElevenLabsAdapter } from '../src/integration/voice-agent-adapter';
import type { Bootstrap } from '../src/integration/types';
test('real session events drive companion; transcript alone never claims playback',()=>{
 assert.equal(nextCompanionState('idle',{type:'connecting'}),'connecting');
 assert.equal(nextCompanionState('connecting',{type:'connected'}),'listening');
 assert.equal(nextCompanionState('listening',{type:'message_final',role:'user'}),'thinking');
 assert.equal(nextCompanionState('thinking',{type:'message_final',role:'agent'}),'thinking');
 assert.equal(nextCompanionState('thinking',{type:'mode',mode:'speaking'}),'speaking');
 assert.equal(nextCompanionState('speaking',{type:'interrupted'}),'interrupted');
 assert.equal(nextCompanionState('speaking',{type:'error'}),'disconnected');
});
test('automatic routing prefers communication headsets, then private handset audio',()=>{
 assert.equal(preferredRoute(['speaker','earpiece','bluetooth','headset']),'bluetooth');
 assert.equal(preferredRoute(['earpiece','speaker','headset']),'headset');
 assert.equal(preferredRoute(['speaker','earpiece']),'earpiece');
 assert.equal(preferredRoute(['speaker']),'speaker');assert.equal(preferredRoute([]),undefined);
});
test('cancel while connecting promptly settles the adapter and skips context delivery',async()=>{
 let ended=0;let contexts=0;
 const adapter=new ElevenLabsAdapter({startSession:()=>{},endSession:()=>{ended++;},sendUserMessage:()=>{},sendContextualUpdate:()=>{contexts++;},setVolume:()=>{}},()=>{});
 const pending=adapter.connect({provider:'elevenlabs',camera_policy:'local_preview_only_no_transmission',mode:'voice',conversation_token:'fixture'} as Bootstrap);
 const rejected=assert.rejects(pending,/interrupted/);await adapter.disconnect();await rejected;
 assert.equal(ended,1);assert.equal(contexts,0);
});
test('installed SDK patch is active; voice permission path never requests camera',()=>{
 const sdk=readFileSync(new URL('../node_modules/@elevenlabs/react-native/dist/index.react-native.js',import.meta.url),'utf8');
 assert.ok(sdk.includes('preferredOutputList: ["bluetooth", "headset", "earpiece", "speaker"]'));
 assert.ok(sdk.includes('AndroidAudioTypePresets.communication'));
 const permissions=readFileSync(new URL('../src/features/call/audio-session.native.ts',import.meta.url),'utf8');
 assert.ok(permissions.includes('PERMISSIONS.RECORD_AUDIO'));assert.ok(!permissions.includes('PERMISSIONS.CAMERA'));
 const screen=readFileSync(new URL('../src/features/call/call-screen.tsx',import.meta.url),'utf8');
 assert.ok(!/takePicture|recordAsync|onBarcodeScanned|sendMultimodal|uploadFile/.test(screen));
});
