import {active} from './ledger.ts';
import type {Ledger,Currency} from './ledger.ts';

export function moneyOwed(state:Ledger,currency:Currency){
 const entries=state.transactions.filter(t=>active(t)&&t.currency===currency&&(t.kind==='loan'||(t.kind==='expense'&&(t.splitOwed||0)>0))).map(t=>{
  const expected=t.kind==='loan'?-t.amount:t.splitOwed!;
  const received=state.transactions.filter(r=>active(r)&&(t.kind==='loan'?r.loanOf===t.id:r.refundOf===t.id&&r.repaymentType==='split')).reduce((sum,r)=>sum+r.amount,0);
  return {id:t.id,type:t.kind==='loan'?'Loan':'Shared expense',person:t.kind==='loan'?t.person:t.splitFrom||'Others',merchant:t.merchant||t.category,expected,received,remaining:Math.max(0,expected-received)};
 });
 return {entries,loans:entries.filter(e=>e.type==='Loan').reduce((s,e)=>s+e.remaining,0),splits:entries.filter(e=>e.type==='Shared expense').reduce((s,e)=>s+e.remaining,0),received:entries.reduce((s,e)=>s+e.received,0)};
}
export function trackSplit(state:Ledger,id:string,amount:number,person:string):Ledger{
 const t=state.transactions.find(t=>t.id===id);
 if(!t||!active(t)||t.kind!=='expense'||!Number.isSafeInteger(amount)||amount<0||amount>-t.amount)throw Error('The shared amount must be between zero and the original expense.');
 const paid=state.transactions.filter(r=>active(r)&&r.refundOf===id&&r.repaymentType==='split').reduce((s,r)=>s+r.amount,0);
 if(amount<paid)throw Error('The shared amount cannot be lower than repayments already matched.');
 if(amount>0&&!person.trim())throw Error('Enter who owes you this share.');
 return {...state,transactions:state.transactions.map(x=>x.id===id?{...x,splitOwed:amount,splitFrom:person.trim()}:x)};
}
export function linkRepayment(state:Ledger,incomingId:string,originalId:string,type:'loan'|'split'):Ledger{
 const r=state.transactions.find(t=>t.id===incomingId),o=state.transactions.find(t=>t.id===originalId);
 if(!r||!o||r.id===o.id||!active(r)||!active(o)||r.amount<=0||r.currency!==o.currency||r.date<o.date||r.transferId||r.refundOf||r.loanOf||r.kind!=='unreviewed')throw Error('Choose an unreviewed incoming payment and its original transaction in the same currency.');
 if(type==='loan'?o.kind!=='loan':o.kind!=='expense')throw Error('Choose a loan or a tracked shared expense.');
 const expected=type==='loan'?-o.amount:(o.splitOwed||-o.amount);
 const paid=state.transactions.filter(x=>active(x)&&(type==='loan'?x.loanOf===o.id:x.refundOf===o.id&&x.repaymentType==='split')).reduce((s,x)=>s+x.amount,0);
 if(paid+r.amount>expected)throw Error('This payment exceeds the amount still owed. Split any extra amount into a separate transaction.');
 if(type==='split'&&state.transactions.filter(x=>active(x)&&x.refundOf===o.id).reduce((s,x)=>s+x.amount,0)+r.amount>-o.amount)throw Error('Returns cannot exceed the original expense.');
 return {...state,transactions:state.transactions.map(x=>x.id===o.id&&type==='split'&&!o.splitOwed?{...x,splitOwed:r.amount,splitFrom:r.merchant||'Others'}:x.id===r.id?{...x,kind:type==='loan'?'loanRepayment':'refund',loanOf:type==='loan'?o.id:undefined,refundOf:type==='split'?o.id:undefined,repaymentType:type==='split'?'split':undefined,category:type==='loan'?'Loan repayment':o.category,merchant:r.merchant|| (type==='loan'?o.person:o.splitFrom),person:o.person,reason:r.reason||r.description}:x)};
}

