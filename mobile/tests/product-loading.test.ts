import test from 'node:test';
import assert from 'node:assert/strict';
import {loadSection} from '../src/features/product/load-section';
test('catalogue publishes before a slow unrelated section completes',async()=>{
 let release!:(value:string)=>void;const events:string[]=[];
 const slow=loadSection(new Promise<string>(resolve=>{release=resolve;}),()=>true,v=>events.push(v));
 await loadSection(Promise.resolve('catalogue'),()=>true,v=>events.push(v),()=>events.push('catalogue-ready'));
 assert.deepEqual(events,['catalogue','catalogue-ready']);
 release('other');await slow;assert.equal(events.at(-1),'other');
});
test('late results and loading callbacks from a signed-out epoch cannot update the UI',async()=>{
 let current=true;let release!:(value:string)=>void;const events:string[]=[];
 const pending=loadSection(new Promise<string>(resolve=>{release=resolve;}),()=>current,v=>events.push(v),()=>events.push('ready'));
 current=false;release('previous patient');await pending;assert.deepEqual(events,[]);
});
test('failed catalogue releases its loader and preserves rejection for error handling',async()=>{
 let settled=false;
 await assert.rejects(loadSection(Promise.reject(Error('offline')),()=>true,()=>{},()=>{settled=true;}),/offline/);
 assert.equal(settled,true);
});
