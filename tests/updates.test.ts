import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyLedger,accounts,updateAccounts} from '../src/ledger.ts';
import {periodRange,shiftPeriod} from '../src/periods.ts';
import {offlineProposal} from '../src/offline-assistant.ts';
import {yearDemo} from '../src/year-demo.ts';
import {categorize} from '../server/groq.ts';
test('new users have no preset banks and migration preserves used and explicitly added accounts',()=>{
 const s=emptyLedger();assert.equal(s.accounts.length,0);assert.equal(s.autoClassifyKnown,true);
 const t=yearDemo().transactions[0];const migrated=updateAccounts({...s,accountSetupVersion:undefined,accounts:[...accounts,{id:'mine',name:'My bank',type:'bank',currency:'USD',addedByUser:true}],transactions:[t]});
 assert.deepEqual(migrated.accounts.map(a=>a.id),[t.accountId,'mine']);assert.deepEqual(updateAccounts(migrated),migrated);
});
test('periods handle year boundaries, leap days and quarter shifts',()=>{
 assert.deepEqual(periodRange('2025-01-01','Week'),{from:'2024-12-29',to:'2025-01-04'});
 assert.deepEqual(periodRange('2026-10-18','Week'),{from:'2026-10-18',to:'2026-10-24'});
 assert.equal(periodRange('2024-02-20','Month').to,'2024-02-29');
 assert.deepEqual(periodRange('2025-05-02','Quarter'),{from:'2025-04-01',to:'2025-06-30'});
 assert.equal(shiftPeriod('2025-12-31','Month',1),'2026-01-01');assert.equal(shiftPeriod('2025-01-02','Quarter',-1),'2024-10-01');
});
test('offline fallback reuses exact confirmed history and leaves changed purposes for review',()=>{
 const state=yearDemo(),old=state.transactions.find(t=>t.merchant==='Netflix')!,tx={...old,id:'new'};
 assert.equal(offlineProposal(state,tx,old.reason).kind,'expense');
 const uncertain=offlineProposal(state,tx,'Lent money to someone');assert.equal(uncertain.kind,'unreviewed');assert.equal(uncertain.basis,'offline-review');
});
test('AI retries transient errors once and never loops on quota or bad credentials',async()=>{
 const input={transaction:{description:'dinner',amount:-1500,currency:'USD'},answer:'Dinner at Chipotle',history:[]};
 for(const status of [401,429]){let calls=0;await assert.rejects(categorize(input,'test',async()=>{calls++;return new Response('',{status});}));assert.equal(calls,1);}
 let calls=0;await assert.rejects(categorize(input,'test',async()=>{calls++;return new Response('',{status:503});}));assert.equal(calls,2);
});
