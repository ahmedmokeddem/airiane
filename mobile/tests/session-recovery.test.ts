import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionForConnection} from '../src/integration/session-recovery';
import type {Session} from '../src/integration/types';
const current={session_id:'old',state:'active',version:1,current_connection_id:null} as Session;
test('restored session with unknown open connection gets a new call session without takeover',async()=>{
 const fresh={...current,session_id:'new'};let created=0;
 const result=await sessionForConnection(current,async()=>({...current,current_connection_id:'unknown'}),async()=>{created++;return fresh;});
 assert.equal(result,fresh);assert.equal(created,1);assert.equal(current.session_id,'old');
});
test('closed provider connection reuses refreshed session and propagates read errors',async()=>{
 const fresh={...current,version:3};
 assert.equal(await sessionForConnection(current,async()=>fresh,async()=>{throw Error('must not create');}),fresh);
 await assert.rejects(sessionForConnection(current,async()=>{throw Error('offline');},async()=>current),/offline/);
});
test('first connection creates a session without redundant reads',async()=>{
 let creates=0;
 assert.equal(await sessionForConnection(null,async()=>{throw Error('unnecessary read');},async()=>{creates++;return current;}),current);
 assert.equal(creates,1);
});
