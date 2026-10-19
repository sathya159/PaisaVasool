import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyLedger,demoLedger,cents,totals,importRows,linkTransfer,linkRefund,review,unlink,suggest,validDate} from './fixture.ts';
import type {Transaction} from './fixture.ts';
import {parseCSV,inferMapping,csvTransactions} from '../src/csv.ts';
const tx=(id:string,extra:Partial<Transaction>={}):Transaction=>({id,accountId:'bofa',date:'2026-09-05',description:'Store',amount:-10000,currency:'USD',kind:'unreviewed',person:'',category:'',reason:'',...extra});
test('money parsing uses minor units, including lakh separators',()=>{
 assert.equal(cents('1,50,000.25'),15000025);assert.equal(cents('(35.50)'),-3550);
 assert.throws(()=>cents('1.234'));assert.throws(()=>cents('NaN'));
});
test('invalid dates do not normalize silently',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);});
test('NRO funding is excluded; INR family payments count once',()=>{
 const x=demoLedger();assert.equal(totals(x,'INR').expense,4000000);assert.equal(totals(x,'USD').expense,9349);
 assert.equal(totals(x,'USD').income,420000);assert.equal(totals(x,'USD').invested,50000);
});
test('cross-currency transfer remains excluded after matching',()=>{
 let x=emptyLedger();x.transactions=[tx('a',{amount:-200000}),tx('b',{accountId:'kotak',currency:'INR',amount:16600000})];
 x=linkTransfer(x,'a','b');assert.equal(totals(x,'USD').expense,0);assert.equal(totals(x,'INR').income,0);assert.equal(x.transactions[0].transferId,x.transactions[1].transferId);
});
test('credit card payment pairs are not expenses',()=>{
 let x=emptyLedger();x.transactions=[tx('a'),tx('b',{accountId:'amex',amount:10000})];
 x=linkTransfer(x,'a','b');assert.equal(totals(x,'USD').expense,0);
});
test('same-currency mismatches and same-account matches are rejected',()=>{
 let x=emptyLedger();x.transactions=[tx('a'),tx('b',{accountId:'amex',amount:9000})];assert.throws(()=>linkTransfer(x,'a','b'));
 x.transactions[1]=tx('b',{amount:10000});assert.throws(()=>linkTransfer(x,'a','b'));
});
test('partial refunds net against the original recipient',()=>{
 let x=emptyLedger();x.transactions=[tx('a',{kind:'expense',person:'Father',category:'Medical'}),tx('r',{amount:3500})];
 x=linkRefund(x,'r','a');assert.equal(totals(x,'USD','','9999-12-31','Father').expense,6500);
});
test('excessive, cross-currency and earlier refunds are blocked',()=>{
 let x=emptyLedger();x.transactions=[tx('a',{kind:'expense'}),tx('r',{amount:10001})];assert.throws(()=>linkRefund(x,'r','a'));
 x.transactions[1]=tx('r',{accountId:'kotak',currency:'INR',amount:100});assert.throws(()=>linkRefund(x,'r','a'));
 x.transactions[1]=tx('r',{date:'2026-09-01',amount:100});assert.throws(()=>linkRefund(x,'r','a'));
});
test('multiple partial refunds cannot exceed original total',()=>{
 let x=emptyLedger();x.transactions=[tx('a',{kind:'expense'}),tx('r',{amount:7000}),tx('r2',{amount:4000})];
 x=linkRefund(x,'r','a');assert.throws(()=>linkRefund(x,'r2','a'));
});
test('refund in a later month reduces that month’s cash spending',()=>{
 let x=emptyLedger();x.transactions=[tx('a',{date:'2026-08-01',kind:'expense'}),tx('r',{amount:3500})];
 x=linkRefund(x,'r','a');assert.equal(totals(x,'USD','2026-09-01','2026-09-30').expense,-3500);
});
test('linked entries cannot be reclassified until unlinked',()=>{
 const x=demoLedger();assert.throws(()=>review(x,{...x.transactions.find(t=>t.id==='shop')!,category:'Other',reason:'Other'}));
 const y=unlink(x,'shop');assert.equal(y.transactions.find(t=>t.id==='refund')!.kind,'unreviewed');
});
test('unlinking either transfer leg returns both to review',()=>{
 const x=unlink(demoLedger(),'wire');assert.equal(x.transactions.find(t=>t.id==='nro')!.kind,'unreviewed');
});
test('date range is inclusive and exact source repeats are idempotent',()=>{
 const rows=[tx('a',{source:'csv',sourceId:'1'}),tx('b',{date:'2026-08-31',source:'csv',sourceId:'2'})];
 const x=importRows(emptyLedger(),rows,'2026-09-05','2026-09-05');assert.equal(x.added,1);assert.equal(x.outside,1);
 const y=importRows(x.state,rows,'2026-09-01','2026-09-30');assert.equal(y.added,0);assert.equal(y.skipped,1);
});
test('same-looking transactions are held as possible duplicates, never erased',()=>{
 const x=importRows(emptyLedger(),[tx('a'),tx('b')],'2026-09-01','2026-09-30');
 assert.equal(x.state.transactions.length,2);assert.equal(x.possible,1);assert.equal(x.state.transactions[1].duplicateOf,'a');
});
test('different accounts do not collide during import',()=>{
 const x=importRows(emptyLedger(),[tx('a',{sourceId:'1',source:'csv'}),tx('b',{accountId:'amex',sourceId:'1',source:'csv'})],'2026-09-01','2026-09-30');
 assert.equal(x.added,2);assert.equal(x.possible,0);
});
test('learned reason is scoped to person and normalizes categories',()=>{
 let x=review(emptyLedger(),tx('a',{kind:'expense',person:'Father',reason:'Seeds for next season',category:'Farming'}));
 assert.equal(suggest(x,'Seeds for next season','Father'),'Farming');assert.equal(suggest(x,'Something else','Brother'),'');
 x=review(x,tx('b',{kind:'expense',person:'Father',reason:'More supplies',category:' farming '}));assert.equal(x.transactions[1].category,'Farming');
});
test('CSV handles BOM, quoted commas, escaped quotes and CRLF',()=>{
 const r=parseCSV('\uFEFFDate,Description,Amount\r\n2026-09-05,"Store, ""West""",-20.50\r\n');
 assert.equal(r[1][1],'Store, "West"');assert.equal(csvTransactions(r,inferMapping(r[0]),emptyLedger().accounts[0],'hash')[0].amount,-2050);
});
test('CSV date and sign mappings support card exports',()=>{
 const r=parseCSV('Date,Description,Amount\n09/05/2026,Store,20.50');
 const m={...inferMapping(r[0]),format:'MDY' as const,outPositive:true};
 const t=csvTransactions(r,m,emptyLedger().accounts[2],'hash')[0];assert.equal(t.date,'2026-09-05');assert.equal(t.amount,-2050);
});
test('CSV separate debit and credit columns preserve money direction',()=>{
 const r=parseCSV('Date,Narration,Debit,Credit\n05/09/2026,UPI,15000,\n06/09/2026,Refund,,200');
 const m={...inferMapping(r[0]),format:'DMY' as const};
 const t=csvTransactions(r,m,emptyLedger().accounts[4],'hash');assert.equal(t[0].amount,-1500000);assert.equal(t[1].amount,20000);
});
test('malformed CSV or invalid row fails without partial import',()=>{
 assert.throws(()=>parseCSV('Date,Amount\n"unclosed,20'));
 const r=parseCSV('Date,Description,Amount\n2026-09-05,Store,20\n2026-02-30,Store,5');
 assert.throws(()=>csvTransactions(r,inferMapping(r[0]),emptyLedger().accounts[0],'hash'));
});
test('family-held funds exclude funding but include actual family spend',()=>{
 let x=emptyLedger();x.transactions=[tx('a',{accountId:'kotak',currency:'INR',amount:-1000000}),tx('b',{accountId:'parents-fund',currency:'INR',amount:1000000}),tx('c',{accountId:'parents-fund',currency:'INR',amount:-100000,kind:'expense',person:'Father',category:'Farming'})];
 x=linkTransfer(x,'a','b');assert.equal(totals(x,'INR').expense,100000);
});

