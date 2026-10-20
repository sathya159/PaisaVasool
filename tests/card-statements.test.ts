import test from 'node:test';
import assert from 'node:assert/strict';
import {cardStatement,saveCardStatement,cardBalance,markCardPayment,matchCardPayments} from '../src/card-statements.ts';
import {emptyLedger,importRows,linkTransfer,totals} from '../src/ledger.ts';
import type {Account,Transaction} from '../src/ledger.ts';
import {statementRows} from '../src/statement-import.ts';
const card:Account={id:'card',name:'Card',type:'card',currency:'USD'},bank:Account={id:'bank',name:'Savings',type:'bank',currency:'USD'};
const summary=cardStatement({closingDate:'2026-09-30',dueDate:'2026-10-25',balance:'1000',minimum:'25',opening:'1200'},'hash');
const tx=(id:string,date:string,amount:number,accountId='card'):Transaction=>({id,date,amount,accountId,currency:'USD',description:'Payment',kind:'unreviewed',person:'',category:'',reason:''});
test('closing balance already includes old payments; only later card-side payments reduce statement bill',()=>{
 let state={...emptyLedger(),accounts:saveCardStatement([card,bank],'card',summary),transactions:[tx('old','2026-09-29',20000),tx('paid','2026-10-03',40000),tx('bank','2026-10-03',-40000,'bank'),tx('shop','2026-10-05',-15000),tx('refund','2026-10-06',5000)]};
 state=markCardPayment(state,'old');state=markCardPayment(state,'paid');state=linkTransfer(state,'paid','bank');
 const b=cardBalance(state,state.accounts[0],'2026-10-19')!;
 assert.equal(b.payments,40000);assert.equal(b.remaining,60000);assert.equal(b.estimated,70000);assert.equal(b.credits,5000);assert.equal(b.statement.minimum,2500);
 assert.equal(totals(state,'USD').income,0);assert.equal(totals(state,'USD').expense,0);
 assert.equal(cardBalance(state,state.accounts[0],'2026-09-30')!.remaining,100000);
});
test('statement import classifies bill payment but not merchant refunds; repeated imports do not reduce balance twice',()=>{
 const row={date:'2026-10-02',description:'PAYMENT THANK YOU',amount:'400',currency:'USD',accountId:'card',evidence:'PAYMENT THANK YOU 400'};
 const rows=statementRows([row,{...row,description:'Refund from store'}],[card],'pdf');
 assert.equal(rows[0].cardPayment,true);assert.equal(rows[1].cardPayment,false);
 const first=importRows({...emptyLedger(),accounts:saveCardStatement([card],'card',summary)},rows,'2026-10-01','2026-10-31');
 const again=importRows(first.state,rows,'2026-10-01','2026-10-31');
 assert.equal(again.skipped,2);assert.equal(cardBalance(again.state,again.state.accounts[0],'2026-10-31')!.payments,40000);
});
test('reimport replaces same closing date, retains history; missing values and zero/credit balances handled',()=>{
 let accounts=saveCardStatement([card],'card',summary);
 accounts=saveCardStatement(accounts,'card',{...summary,balance:0});assert.equal(accounts[0].cardStatements!.length,1);
 assert.equal(cardBalance({...emptyLedger(),accounts},accounts[0],'2026-10-01')!.remaining,0);
 assert.throws(()=>cardStatement({closingDate:'2026-02-30',dueDate:'',balance:'10',minimum:'',opening:''},'h'));
 assert.throws(()=>cardStatement({closingDate:'2026-09-30',dueDate:'',balance:'',minimum:'',opening:''},'h'));
 const credit=cardStatement({closingDate:'2026-10-31',dueDate:'',balance:'-50',minimum:'0',opening:''},'h');
 accounts=saveCardStatement(accounts,'card',credit);assert.equal(accounts[0].cardStatements!.length,2);
 assert.equal(cardBalance({...emptyLedger(),accounts},accounts[0],'2026-11-01')!.estimated,-5000);
});
test('matching is one-to-one and ambiguous same-amount payments remain unlinked',()=>{
 const transactions=[{...tx('a','2026-10-01',10000),kind:'transfer' as const,cardPayment:true},{...tx('b','2026-10-02',-10000,'bank'),kind:'transfer' as const,cardPayment:true}];
 const state={...emptyLedger(),accounts:[card,bank],transactions};
 const matched=matchCardPayments(state);assert.ok(matched.transactions[0].transferId);assert.equal(matched.transactions[0].transferId,matched.transactions[1].transferId);
 const ambiguous=matchCardPayments({...state,transactions:[...transactions,{...transactions[0],id:'c'}]});assert.ok(ambiguous.transactions.every(t=>!t.transferId));
});
test('reimport repairs an old payment classified as income without adding spending or another payment',()=>{
 const row=statementRows([{date:'2026-10-02',description:'PAYMENT - THANK YOU',amount:'400',currency:'USD',accountId:'card',evidence:'PAYMENT - THANK YOU 400'}],[card],'pdf')[0];
 const old={...row,cardPayment:false,kind:'income' as const};
 const state={...emptyLedger(),accounts:[card],transactions:[old]};
 const result=importRows(state,[row],'2026-10-01','2026-10-31');assert.equal(result.skipped,1);assert.equal(result.state.transactions.length,1);assert.equal(totals(result.state,'USD').income,0);
});
