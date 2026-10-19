import test from 'node:test';
import assert from 'node:assert/strict';
import {spendingReport,recurringPayments,possibleRepeatedCharges} from '../src/analytics.ts';
import {yearDemo} from '../src/year-demo.ts';
import {emptyLedger} from './fixture.ts';
test('year demo is deterministic, isolated, and contains both currencies for 12 months',()=>{
 const original=emptyLedger();const demo=yearDemo();assert.ok(demo.transactions.length>300);assert.equal(original.transactions.length,0);assert.equal(new Set(demo.transactions.map(t=>t.date.slice(0,7))).size,12);assert.deepEqual(demo,yearDemo());
});
test('vendor reports assign repayments back to the original merchant and respect month/currency',()=>{
 const d=yearDemo();const jan=spendingReport(d,'USD',2025,0);assert.equal(jan.vendors.find(v=>v.name==='Oakwood Apartments')?.amount,110000);assert.ok(!jan.vendors.some(v=>v.name==='Father'));assert.equal(jan.total.income,520000);
 const full=spendingReport(d,'USD',2025,null);assert.equal(full.months.reduce((s,m)=>s+m.expense,0),full.total.expense);
});
test('recurring detection finds monthly subscriptions and skips frequent random visits',()=>{
 const repeat=recurringPayments(yearDemo(),'USD'),netflix=repeat.find(r=>r.name==='Netflix');assert.equal(netflix?.chargesPerMonth,2);assert.equal(netflix?.amount,3098);assert.ok(repeat.some(r=>r.name==='Spotify'));assert.ok(!repeat.some(r=>r.name==='Vanguard'));
 const s=emptyLedger();s.transactions=yearDemo().transactions.filter(t=>t.merchant==='Netflix').slice(0,1);assert.equal(recurringPayments(s,'USD').length,0);
 s.transactions.push({...s.transactions[0],id:'gap',date:'2025-03-04'});assert.equal(recurringPayments(s,'USD').length,0);
});
test('possible repeated charges find same merchant and amount in one month without changing totals',()=>{
 const d=yearDemo(),jan=possibleRepeatedCharges(d,'USD','2025-01-01','2025-01-31');
 assert.equal(jan.length,1);assert.equal(jan[0].name,'Netflix');assert.equal(jan[0].count,2);assert.equal(jan[0].amount,1549);assert.equal(jan[0].accountIds.length,2);
 const before=spendingReport(d,'USD',2025,0).total.expense;
 d.transactions.push({...d.transactions.find(t=>t.merchant==='Netflix')!,id:'ignored-copy',duplicateOf:'year-demo-2'});
 assert.equal(possibleRepeatedCharges(d,'USD','2025-01-01','2025-01-31')[0].count,2);assert.equal(spendingReport(d,'USD',2025,0).total.expense,before);
});

