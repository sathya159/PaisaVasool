import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyLedger,totals,unlink,review,linkTransfer,linkRefund} from './fixture.ts';
import type {Transaction} from './fixture.ts';
import {trackSplit,moneyOwed,linkRepayment} from '../src/receivables.ts';
import {canonicalMerchant} from '../src/merchants.ts';
const tx=(id:string,amount:number,extra:Partial<Transaction>={}):Transaction=>({id,amount,accountId:'bofa',currency:'USD',date:'2026-09-24',kind:'unreviewed',person:'Me',category:'',reason:'Example',description:'Example',...extra});
test('partial loan repayments reduce the balance without becoming income or spending',()=>{
 let s=emptyLedger();s.transactions=[tx('loan',-10000,{kind:'loan',person:'Sunandhan',category:'Loans lent'}),tx('pay',4000),tx('rest',6000)];
 s=linkRepayment(s,'pay','loan','loan');assert.equal(moneyOwed(s,'USD').loans,6000);
 assert.equal(totals(s,'USD').income,0);assert.equal(totals(s,'USD').expense,0);
 s=linkRepayment(s,'rest','loan','loan');assert.equal(moneyOwed(s,'USD').loans,0);assert.equal(moneyOwed(s,'USD').received,10000);
 assert.throws(()=>linkRepayment(s,'pay','loan','loan'));
 assert.equal(moneyOwed(unlink(s,'pay'),'USD').loans,4000);
 assert.throws(()=>review(s,s.transactions[0]),/Unlink/);
});
test('shared repayment reduces spending, only matched split credits settle the share',()=>{
 let s=emptyLedger();s.transactions=[tx('meal',-10000,{kind:'expense',category:'Dining'}),tx('share',3000),tx('refund',1000)];
 s=trackSplit(s,'meal',5000,'Sunandhan');s=linkRepayment(s,'share','meal','split');s=linkRefund(s,'refund','meal');
 assert.equal(moneyOwed(s,'USD').splits,2000);assert.equal(totals(s,'USD').expense,6000);assert.equal(totals(s,'USD').income,0);
 assert.throws(()=>trackSplit(s,'meal',2000,'Sunandhan'));
 assert.equal(moneyOwed(unlink(s,'share'),'USD').splits,5000);
});
test('reject overpayments, different currencies, earlier dates, duplicates and cross-matching',()=>{
 const s=emptyLedger();s.transactions=[tx('loan',-1000,{kind:'loan',person:'Sunandhan',category:'Loans lent'}),tx('credit',1100)];
 assert.throws(()=>linkRepayment(s,'credit','loan','loan'));
 for(const patch of [{currency:'INR' as const,accountId:'kotak'},{date:'2026-09-23'},{duplicateOf:'other'}]){s.transactions[1]=tx('credit',500,patch);assert.throws(()=>linkRepayment(s,'credit','loan','loan'));}
 s.transactions[1]=tx('credit',500);const next=linkRepayment(s,'credit','loan','loan');
 next.transactions.push(tx('other',-500,{accountId:'bcu'}));
 assert.throws(()=>linkTransfer(next,'credit','other'),/Unlink/);
 assert.equal(moneyOwed(next,'INR').loans,0);
});
test('known merchant typos normalize without altering unfamiliar names',()=>{
 assert.equal(canonicalMerchant('chickfilaes'),'Chick-fil-A');assert.equal(canonicalMerchant('Chick fil a'),'Chick-fil-A');assert.equal(canonicalMerchant('Sunandhan'),'Sunandhan');
});

