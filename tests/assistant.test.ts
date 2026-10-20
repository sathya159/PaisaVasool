import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyLedger,updateAccounts} from './fixture.ts';
import type {Transaction} from './fixture.ts';
import {learnedProposal,acceptProposals,reasonOnlyProposal,applyKnownHistory,extractedTransactions,validateProposal} from '../src/assistant.ts';
const tx=(id:string,extra:Partial<Transaction>={}):Transaction=>({id,accountId:'bofa',date:'2026-09-05',description:'Grocery shop',amount:-10000,currency:'USD',kind:'unreviewed',person:'',category:'',reason:'',...extra});
test('consistent account/merchant history proposes previous category',()=>{
 const x=emptyLedger();x.transactions=[tx('old',{kind:'expense',person:'Me',category:'Groceries',reason:'Weekly groceries'}),tx('new')];
 assert.equal(learnedProposal(x,x.transactions[1])?.category,'Groceries');
 const result=acceptProposals(x,[learnedProposal(x,x.transactions[1])!]);
 assert.equal(result.transactions[1].kind,'expense');
});
test('conflicting merchant history does not automatically classify',()=>{
 const x=emptyLedger();x.transactions=[tx('old',{kind:'expense',person:'Me',category:'Groceries',reason:'Groceries'}),tx('old2',{kind:'expense',person:'Me',category:'Household',reason:'Cleaning supplies'}),tx('new')];
 assert.equal(learnedProposal(x,x.transactions[2]),undefined);
});
test('family payments need fresh reasons even if a previous one is known',()=>{
 const x=emptyLedger();x.transactions=[tx('old',{description:'UPI Dad',kind:'expense',person:'Father',category:'Farming',reason:'Seeds'}),tx('new',{description:'UPI Dad'})];
 assert.equal(learnedProposal(x,x.transactions[1]),undefined);
});
test('remembered vendor categories cross accounts but not direction',()=>{
 const x=emptyLedger();x.transactions=[tx('old',{kind:'expense',person:'Me',category:'Groceries',reason:'Weekly groceries'})];
 assert.equal(learnedProposal(x,tx('new',{accountId:'amex'}))?.category,'Groceries');
 assert.equal(learnedProposal(x,tx('new',{amount:10000})),undefined);
});
test('automatic reuse requires opt-in and skips ambiguous duplicates',()=>{
 const x=emptyLedger();x.transactions=[tx('old',{kind:'expense',person:'Me',category:'Groceries',reason:'Weekly groceries'}),tx('new'),tx('dup',{duplicateOf:'old'})];
 assert.equal(applyKnownHistory(x).count,0);
 const result=applyKnownHistory({...x,autoClassifyKnown:true});assert.equal(result.count,1);assert.equal(result.state.transactions[2].kind,'unreviewed');
});
test('one sentence supplies person, reason and category',()=>{
 const x=emptyLedger();const p=reasonOnlyProposal(x,tx('new'),'Dad’s medicine');
 assert.equal(p?.person,'Father');assert.equal(p?.category,'Medical');
});
test('suggestions cannot overwrite reviewed entries or save unanswered questions',()=>{
 const x=emptyLedger();x.transactions=[tx('new')];const p=reasonOnlyProposal(x,x.transactions[0],'Weekly groceries')!;
 assert.throws(()=>acceptProposals(x,[{...p,question:'Who was this for?'}]));
 const saved=acceptProposals(x,[p]);assert.throws(()=>acceptProposals(saved,[p]));
});
test('AI suggestions cannot change signs, types or transaction identity',()=>{
 const t=tx('x');const p={id:'x',kind:'expense',person:'Me',category:'Groceries',reason:'Food',question:'',basis:'Answer',confidence:.5};
 assert.throws(()=>validateProposal({...p,id:'wrong'},t));
 assert.throws(()=>validateProposal({...p,kind:'income'},t));
 assert.throws(()=>validateProposal({...p,kind:'transfer'},t));
});
test('statement extraction validates currency, date and minor units',()=>{
 const account=emptyLedger().accounts[0];
 const rows=extractedTransactions([{date:'2026-09-05',description:'Store',amount:'-12.50',currency:'USD',evidence:'09/05 Store 12.50'}],account,'hash');
 assert.equal(rows[0].amount,-1250);assert.equal(rows[0].kind,'unreviewed');assert.equal(rows[0].sourceId,'hash:0');
 assert.throws(()=>extractedTransactions([{date:'2026-02-30',description:'Store',amount:'-12.50',currency:'USD',evidence:'row'}],account,'hash'));
 assert.throws(()=>extractedTransactions([{date:'2026-09-05',description:'Store',amount:'-12.50',currency:'INR',evidence:'row'}],account,'hash'));
});
test('account migration preserves used accounts without adding preset banks',()=>{
 const x=emptyLedger();x.accounts=x.accounts.filter(a=>a.id!=='bcu-card').map(a=>a.id==='bcu'?{...a,name:'BCU'}:a);
 x.transactions=[tx('bank',{accountId:'bcu'})];
 const migrated=updateAccounts(x);assert.equal(migrated.accounts.find(a=>a.id==='bcu')?.name,'BCU Checking');
 assert.equal(migrated.accounts.find(a=>a.id==='bcu-card'),undefined);assert.equal(migrated.transactions[0].accountId,'bcu');
 assert.equal(updateAccounts(migrated).accounts.length,migrated.accounts.length);
});
test('unknown but specific reason creates a category without asking user to pick one',()=>{
 const p=reasonOnlyProposal(emptyLedger(),tx('new'),'Pottery workshop');
 assert.equal(p?.category,'Pottery Workshop');assert.equal(p?.question,'');
});
test('vague reason asks for the purpose, not a category',()=>{
 const p=reasonOnlyProposal(emptyLedger(),tx('new'),'Sent money to dad');
 assert.equal(p?.kind,'unreviewed');assert.match(p!.question,/actually cover/);
});
test('refund reason cannot be mislabeled as an ordinary expense',()=>{
 const p=reasonOnlyProposal(emptyLedger(),tx('new',{amount:3500}),'refund for groceries');
 assert.equal(p?.kind,'unreviewed');
});
test('salary and investment reasons are categorized separately',()=>{
 assert.equal(reasonOnlyProposal(emptyLedger(),tx('new',{amount:3500}),'monthly salary')?.category,'Salary');
 assert.equal(reasonOnlyProposal(emptyLedger(),tx('new'),'invested in ETF')?.kind,'investment');
});

test('ordinary detailed spending defaults to myself without a relationship question',()=>{
 const p=reasonOnlyProposal(emptyLedger(),tx('new'),'Bought vegetables and milk for my weekly meals');
 assert.equal(p?.person,'Me');assert.equal(p?.category,'Groceries');assert.equal(p?.question,'');
});
test('explicit self overrides incidental relationship and family purpose remains automatic',()=>{
 const p=reasonOnlyProposal(emptyLedger(),tx('new'),'Bought medicine for myself while visiting my brother');
 assert.equal(p?.person,'Me');assert.equal(p?.category,'Medical');
 const family=reasonOnlyProposal(emptyLedger(),tx('new'),'Paid my brother’s college tuition for this semester');
 assert.equal(family?.person,'Brother');assert.equal(family?.category,'Education');assert.equal(family?.question,'');
});
test('purchase purpose takes priority over background context',()=>{
 const p=reasonOnlyProposal(emptyLedger(),tx('new'),'Paid for my brother’s dinner after his college visit');
 assert.equal(p?.category,'Dining');assert.equal(p?.person,'Brother');
});
test('reuses a consistent custom category for similar medical reasons',()=>{
 const state=emptyLedger();state.rules=[{person:'Me',reason:'Doctor appointment',category:'Healthcare'}];
 assert.equal(reasonOnlyProposal(state,tx('new'),'Prescription medicine')?.category,'Healthcare');
});
