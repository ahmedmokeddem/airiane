import test from 'node:test';
import assert from 'node:assert/strict';
import {carryApprovedRecap} from '../src/features/companion/handoff';
test('raw history is never replayed; a written recap requires explicit approval and a connected session',async()=>{
 const events:string[]=[];
 const connect=async()=>{events.push('connected');};
 const send=(text:string)=>{events.push(text);};
 await assert.rejects(carryApprovedRecap({text:'Fictional approved recap',confirmation:false},connect,send));
 assert.equal(events.length,0);
 await carryApprovedRecap({text:'Fictional approved recap',confirmation:true},connect,send);
 assert.equal(events[0],'connected');assert.ok(events[1].includes('Fictional approved recap'));
 events.length=0;
 await assert.rejects(carryApprovedRecap({text:'Recap',confirmation:true},async()=>{throw Error('Offline');},send));
 assert.equal(events.length,0);
});
