import test from 'node:test';
import assert from 'node:assert/strict';
import {extractStatement} from '../server/statements.ts';
import {useImportAccount,statementRows,statementIssues,statementPeriod,statementAccountKey,assignStatementAccount} from '../src/statement-import.ts';
import {accounts,emptyLedger,importRows} from './fixture.ts';
const text='Bank of America Checking USD\n2025-01-02,Target,-24.50';
const row={date:'2025-01-02',description:'Target',amount:'-24.50',accountId:'bofa',accountName:'Bank of America Checking',accountType:'bank',currency:'USD',evidence:'2025-01-02,Target,-24.50'};
const mock=(rows:unknown[]):typeof fetch=>async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify({rows,warnings:[]})}}]});
test('preselected statement account resolves missing currency but flags conflicting currency without conversion',()=>{
 const account=accounts.find(a=>a.id==='bofa')!;
 const result=useImportAccount([{...row,accountId:'unknown',currency:'unknown',amount:'24.5'},{...row,currency:'INR'}],account);
 assert.equal(result[0].accountId,account.id);assert.equal(result[0].currency,'USD');
 assert.equal(statementRows([result[0]],accounts,'test')[0].amount,2450);
 assert.equal(result[1].currency,'INR');assert.equal(result[1].amount,row.amount);
 assert.ok(statementIssues(result[1],accounts).accountId);
});
test('one decimal amount is valid; account confirmation resolves the whole extracted group only',()=>{
 const first={...row,accountId:'unknown',currency:'unknown',amount:'24.5'};
 const second={...first,amount:'-12.75'};
 const other={...first,accountName:'Another bank'};
 const card={...first,accountType:'card'};
 assert.equal(statementIssues(first,accounts).amount,undefined);
 assert.ok(statementIssues(first,accounts).accountId);
 const account=accounts.find(a=>a.id==='bofa')!;
 const assigned=assignStatementAccount([first,second,other,card],statementAccountKey(first),account);
 assert.deepEqual(statementIssues(assigned[0],accounts),{});
 assert.deepEqual(statementIssues(assigned[1],accounts),{});
 assert.equal(assigned[2].accountId,'unknown');assert.equal(assigned[3].accountId,'unknown');
 assert.equal(statementRows(assigned.slice(0,2),accounts,'test')[0].amount,2450);
 assert.equal(assigned[0].evidence,first.evidence);
});
test('zero entries are skipped without changing source row IDs; blank amounts need correction',()=>{
 const rows=[{...row,amount:'0.00',description:'Interest',date:''},row];
 const result=statementRows(rows,accounts,'file');
 assert.equal(result.length,1);assert.equal(result[0].sourceId,'file:1');
 assert.deepEqual(statementPeriod(rows),{from:row.date,to:row.date});
 assert.deepEqual(statementIssues(rows[0],accounts),{});
 assert.ok(statementIssues({...row,amount:''},accounts).amount);
 assert.throws(()=>statementRows([row,{...row,amount:'invalid'}],accounts,'file'),/Row 2/);
});
test('statement period uses extracted dates and reports each invalid field',()=>{
 assert.deepEqual(statementPeriod([{...row,date:'2025-02-20'},row]),{from:'2025-01-02',to:'2025-02-20'});
 const errors=statementIssues({...row,date:'2025-02-30',amount:'wrong',description:''},accounts);
 assert.ok(errors.date);assert.ok(errors.amount);assert.ok(errors.description);
});
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
