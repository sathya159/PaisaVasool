import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyLedger,totals,review,isCardBillPayment} from '../src/ledger.ts';
import type {Transaction} from '../src/ledger.ts';
import {applyKnownHistory,learnedProposal} from '../src/assistant.ts';
import {repairCardPayments} from '../src/card-statements.ts';
import {spendingReport,recurringPayments,possibleRepeatedCharges} from '../src/analytics.ts';
const tx=(id:string,patch:Partial<Transaction>={}):Transaction=>({id,accountId:'bank',currency:'USD',date:'2026-10-01',description:'Target',amount:-2500,kind:'unreviewed',person:'Me',category:'',reason:'',...patch});
const base=()=>({...emptyLedger(),autoClassifyKnown:true,accounts:[{id:'bank',name:'Savings',currency:'USD' as const,type:'bank' as const},{id:'card',name:'Credit card',currency:'USD' as const,type:'card' as const}]});
test('1000 of purchases and a 600 card payment remains 1000 spending, even with an old refund label',()=>{
 const state={...base(),transactions:[tx('buy',{accountId:'card',amount:-100000,kind:'expense',category:'Shopping'}),tx('paid',{accountId:'card',amount:60000,description:'PAYMENT THANK YOU',kind:'refund',refundOf:'buy',reason:'Refund for shopping'})]};
 assert.equal(totals(state,'USD').expense,100000);
 const repaired=repairCardPayments(state);assert.equal(repaired.transactions[1].refundOf,undefined);assert.equal(repaired.transactions[1].kind,'transfer');
 assert.equal(spendingReport(repaired,'USD',2026,9).total.expense,100000);
 const genuine={...state,transactions:[state.transactions[0],{...state.transactions[1],description:'Merchant refund'}]};
 assert.equal(totals(genuine,'USD').expense,40000);
});
test('old expense and income labels on bill payments never affect any spending chart',()=>{
 const state={...base(),transactions:[tx('buy',{accountId:'card',kind:'expense',category:'Groceries',merchant:'Target',reason:'Groceries'}),tx('pay',{description:'AMEX EPAYMENT ACH PMT',amount:-2500,kind:'expense',merchant:'Amex',category:'Bills'}),tx('receive',{accountId:'card',description:'PAYMENT THANK YOU',amount:2500,kind:'income',category:'Income'}),tx('electric',{description:'Electricity autopay',amount:-1000,kind:'expense',merchant:'Electric company',category:'Utilities'})]};
 assert.equal(totals(state,'USD').expense,3500);assert.equal(totals(state,'USD').income,0);
 const report=spendingReport(state,'USD',2026,9);assert.equal(report.months[9].expense,3500);assert.equal(report.vendors.length,2);assert.equal(report.categories.length,2);
 const repaired=repairCardPayments(state);assert.equal(repaired.transactions[1].kind,'transfer');assert.equal(repaired.transactions[2].transferId,repaired.transactions[1].transferId);assert.ok(repaired.transactions[1].transferId);
 assert.equal(isCardBillPayment(state,tx('ambiguous',{description:'Bill payment'})),false);
 assert.equal(isCardBillPayment(state,tx('refund',{accountId:'card',description:'Payment reversal',amount:2500})),false);
 const flag={...state,transactions:[tx('flag',{kind:'expense',cardPayment:true,merchant:'Payment',category:'Bills'}),tx('flag2',{kind:'expense',cardPayment:true,merchant:'Payment',category:'Bills'})]};
 assert.equal(totals(flag,'USD').expense,0);assert.equal(possibleRepeatedCharges(flag,'USD').length,0);assert.equal(recurringPayments(flag,'USD').length,0);
});
test('one explicit vendor category applies across accounts without merging transactions',()=>{
 let state=review(base(),tx('first',{kind:'expense',merchant:'Target',category:'Groceries',reason:'Bought vegetables'}));
 state={...state,transactions:[...state.transactions,tx('next',{accountId:'card',description:'TARGET 09876',amount:-4500})]};
 const next=applyKnownHistory(state).state;
 assert.equal(next.transactions.length,2);assert.equal(next.transactions[1].category,'Groceries');assert.equal(next.transactions[1].accountId,'card');assert.equal(next.transactions[1].amount,-4500);assert.equal(next.transactions[1].classifiedFromHistory,true);
 assert.equal(next.vendorRules!.length,1);
});
test('subscription uses exact vendor, amount and currency; price changes and changed reasons stay for review',()=>{
 let state=review(base(),tx('first',{description:'NETFLIX.COM',merchant:'Netflix',kind:'expense',amount:-1599,category:'Subscriptions',reason:'Monthly family Netflix subscription'}));
 state={...state,transactions:[...state.transactions,tx('next',{accountId:'card',description:'NETFLIX COM LOS GATOS',amount:-1599}),tx('price',{description:'Netflix',amount:-1799}),tx('currency',{description:'Netflix',currency:'INR',amount:-1599}),tx('typed',{description:'Netflix',amount:-1599,reason:'One-time gift for my friend'})]};
 const next=applyKnownHistory(state).state;
 assert.equal(next.transactions[1].reason,'Monthly family Netflix subscription');assert.equal(next.transactions[1].category,'Subscriptions');
 assert.ok(next.transactions.slice(2).every(t=>t.kind==='unreviewed'));assert.equal(next.transactions[4].reason,'One-time gift for my friend');
});
test('explicit correction updates future memory while leaving other reviewed entries alone',()=>{
 let state=review(base(),tx('first',{kind:'expense',merchant:'Target',category:'Groceries',reason:'Groceries'}));
 state={...state,transactions:[...state.transactions,tx('second',{accountId:'card'})]};state=applyKnownHistory(state).state;
 state=review(state,{...state.transactions[1],category:'Household',reason:'Household supplies'});
 assert.equal(state.transactions[0].category,'Groceries');assert.equal(state.transactions[1].classifiedFromHistory,false);
 const p=learnedProposal(state,tx('future'));assert.equal(p?.category,'Household');
 assert.equal(learnedProposal(state,tx('refund',{amount:2500})),undefined);
});
