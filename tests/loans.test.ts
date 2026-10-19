import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyLedger,review,totals} from './fixture.ts';
import type {Transaction} from './fixture.ts';
import {acceptProposals} from '../src/assistant.ts';
import {activityTitle} from '../src/presentation.ts';
const tx:Transaction={id:'loan-test',accountId:'bofa',currency:'USD',date:'2026-09-24',amount:-10000,kind:'unreviewed',description:'Zelle Sunandhan',sourceId:'bank-id',person:'',reason:'',category:''};
test('loan saves borrower and merchant without counting it as spending or income',()=>{
 const state=emptyLedger();state.transactions=[tx];
 const next=acceptProposals(state,[{id:tx.id,kind:'loan',person:'Sunandhan',merchant:'Sunandhan',category:'Loans lent',reason:'Lent money to my friend Sunandhan',question:'',basis:'Explicit loan',confidence:.9}]);
 assert.equal(next.transactions[0].description,'Zelle Sunandhan');
 assert.equal(next.transactions[0].sourceId,'bank-id');
 assert.equal(activityTitle(next.transactions[0]),'Sunandhan · Loans lent');
 assert.equal(totals(next,'USD').lent,10000);assert.equal(totals(next,'USD').expense,0);assert.equal(totals(next,'USD').income,0);
 assert.throws(()=>review(state,{...next.transactions[0],amount:10000}),/loan/i);
});
test('activity uses merchant/category and never a manual reason as title',()=>{
 assert.equal(activityTitle({...tx,sourceId:undefined,description:'Dinner for myself',reason:'Dinner for myself',merchant:'Olive Garden',category:'Dining'}),'Olive Garden · Dining');
 assert.equal(activityTitle({...tx,sourceId:undefined,description:'Dinner for myself',reason:'Dinner for myself',category:'Dining'}),'Location needed · Dining');
 assert.equal(activityTitle({...tx,category:'Loans lent'}),'Zelle Sunandhan · Loans lent');
});

