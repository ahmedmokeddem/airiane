import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {NativePlayback,nativeTrackName,type NativePlayerPort} from '../src/features/activity/native-playback';
test('native playback cancels preparation after exit and switches actual sources',async()=>{
 const calls:unknown[]=[];
 const player:NativePlayerPort={replace:s=>calls.push(s),play:()=>calls.push('play'),pause:()=>calls.push('pause'),loop:false,muted:false,volume:1};
 let ready=()=>{};
 const playback=new NativePlayback(player,()=>new Promise<void>(resolve=>{ready=resolve;}));
 const start=playback.start(1);playback.stop();ready();await start;
 assert.ok(!calls.includes('play'));
 const next=playback.start(2);ready();await next;
 assert.deepEqual(calls.slice(-2),[2,'play']);
 playback.mute(true);assert.equal(player.muted,true);
 playback.stop();assert.equal(calls.at(-1),null);
});
test('every native nature choice selects a distinct bundled recording',()=>{
 const names=['nordic_forest_birds','gentle_rain','nordic_stream','gamma_40hz_pink_noise'] as const;
 for(const name of names){
 const file=nativeTrackName({kind:'nature'} as Parameters<typeof nativeTrackName>[0],name);
 assert.ok(file.startsWith(name));assert.ok(existsSync(new URL('../assets/audio/'+file,import.meta.url)));
 }
});
