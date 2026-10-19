import test from 'node:test';
import assert from 'node:assert/strict';
import {extractStatement} from '../server/statements.ts';
import {statementRows} from '../src/statement-import.ts';
import {accounts,emptyLedger,importRows} from './fixture.ts';
const text='Bank of America Checking USD\n2025-01-02,Target,-24.50';
const row={date:'2025-01-02',description:'Target',amount:'-24.50',accountId:'bofa',accountName:'Bank of America Checking',accountType:'bank',currency:'USD',evidence:'2025-01-02,Target,-24.50'};
const mock=(rows:unknown[]):typeof fetch=>async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({rows,warnings:[]})}}]});
test('statement extraction evidence must be present and unknown accounts require confirmation',async()=>{
 const parsed=await extractStatement({text},'test',mock([row]));assert.equal(statementRows(parsed.rows,accounts,'hash')[0].amount,-2450);
 await assert.rejects(extractStatement({text},'test',mock([{...row,evidence:'Invented'}])),/verified/);
 assert.throws(()=>statementRows([{...row,accountId:'unknown'}],accounts,'hash'),/Confirm/);
 assert.throws(()=>statementRows([{...row,currency:'INR'}],accounts,'hash'),/Confirm/);
});
test('statement imports preserve identity, apply dates, and skip exact repeats',()=>{
 const rows=statementRows([row],accounts,'hash');const first=importRows(emptyLedger(),rows,'2025-01-01','2025-01-31');assert.equal(first.added,1);assert.equal(importRows(first.state,rows,'2025-01-01','2025-01-31').skipped,1);assert.equal(importRows(emptyLedger(),rows,'2025-02-01','2025-02-28').outside,1);
 assert.throws(()=>statementRows([{...row,date:'2025-02-30'}],accounts,'hash'),/date/);
});

