import test from 'node:test';
import assert from 'node:assert/strict';
import {ExportController} from '../src/features/reports/export-controller';
test('export requires explicit save/share and never shares as a download side effect',async()=>{
 const calls:string[]=[];const controller=new ExportController({download:async()=>{calls.push('download');return 'private-cache://file.pdf';},save:async uri=>{calls.push('save:'+uri);},share:async uri=>{calls.push('share:'+uri);}});
 await assert.rejects(()=>controller.execute('share'),/Export/);
 await controller.execute('download');assert.deepEqual(calls,['download']);assert.equal(controller.ready,true);
 await controller.execute('save');await controller.execute('share');assert.equal(calls.length,3);
});
test('a failed re-export discards the earlier file and allows a retry without duplicate downloads',async()=>{
 let resolve:(value:string)=>void=()=>{};let count=0;let fail=false;
 const controller=new ExportController({download:async()=>{count++;if(fail)throw new Error('CONSENT_REQUIRED');return new Promise(r=>{resolve=r;});},save:async()=>{},share:async()=>{}});
 const pending=controller.execute('download');await controller.execute('download');assert.equal(count,1);resolve('private-cache://a.pdf');await pending;
 fail=true;await assert.rejects(()=>controller.execute('download'),/CONSENT/);assert.equal(controller.ready,false);await assert.rejects(()=>controller.execute('share'),/Export/);
});

test('expired temporary copies require a new export rather than opening a missing file',async()=>{
 let now=0;let shared=false;const c=new ExportController({download:async()=> 'private-cache://report.pdf',save:async()=>{},share:async()=>{shared=true;}},()=>now);
 await c.execute('download');now=16*60*1000;await assert.rejects(()=>c.execute('share'),/expired/);assert.equal(c.ready,false);assert.equal(shared,false);
});
