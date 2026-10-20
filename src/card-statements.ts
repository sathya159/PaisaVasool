import {active,cents,validDate,linkTransfer,isCardBillPayment} from './ledger.ts';
import type {Account,CardStatement,Ledger,Transaction} from './ledger.ts';
export type CardSummaryDraft={closingDate:string;dueDate:string;balance:string;minimum:string;opening:string};
export function cardStatement(draft:CardSummaryDraft,sourceHash:string):CardStatement {
 if(!validDate(draft.closingDate))throw Error('Check the statement closing date.');
 if(draft.dueDate&&(!validDate(draft.dueDate)||draft.dueDate<draft.closingDate))throw Error('Check the payment due date.');
 const balance=cents(draft.balance),minimum=draft.minimum.trim()?cents(draft.minimum):undefined,opening=draft.opening.trim()?cents(draft.opening):undefined;
 if(minimum!==undefined&&minimum<0)throw Error('Minimum payment cannot be negative.');
 return {closingDate:draft.closingDate,dueDate:draft.dueDate||undefined,balance,minimum,opening,sourceHash};
}
export function saveCardStatement(accounts:Account[],id:string,statement:CardStatement):Account[]{
 return accounts.map(a=>a.id!==id?a:{...a,cardStatements:[...(a.cardStatements||[]).filter(s=>s.closingDate!==statement.closingDate),statement].sort((a,b)=>a.closingDate.localeCompare(b.closingDate))});
}
export function looksLikeCardPayment(description:string){
 return !/refund|revers|return|reject|fail|fee|interest/i.test(description)&&/payment\s*(received|thank)|autopay|auto pay|automatic payment|online payment|mobile payment|credit\s*card\s*(bill\s*)?payment/i.test(description.replace(/[^a-z0-9]+/gi,' '));
}
export function matchCardPayments(state:Ledger):Ledger {
 let next=state;
 const eligible=(t:Transaction)=>active(t)&&t.cardPayment&&t.kind==='transfer'&&!t.transferId&&!t.refundOf&&!t.loanOf&&!state.transactions.some(x=>x.refundOf===t.id||x.loanOf===t.id);
 const candidates=(t:Transaction)=>next.transactions.filter(x=>eligible(x)&&x.accountId!==t.accountId&&x.currency===t.currency&&x.amount===-t.amount&&Math.abs(Date.parse(x.date)-Date.parse(t.date))<=7*86400000);
 for(const t of next.transactions.filter(t=>eligible(t)&&t.amount>0&&state.accounts.some(a=>a.id===t.accountId&&a.type==='card'))){
  const matches=candidates(t).filter(x=>state.accounts.some(a=>a.id===x.accountId&&a.type==='bank'));
  if(matches.length===1&&candidates(matches[0]).length===1)next=linkTransfer(next,t.id,matches[0].id);
 }
 return next;
}
export function repairCardPayments(state:Ledger):Ledger{
 const transactions=state.transactions.map(t=>{
  if(!active(t)||!isCardBillPayment(state,t)||t.transferId||t.loanOf||state.transactions.some(x=>x.refundOf===t.id||x.loanOf===t.id))return t;
  return {...t,kind:'transfer' as const,cardPayment:true,refundOf:undefined,category:'Credit card payment',classifiedFromHistory:false};
 });
 return matchCardPayments({...state,transactions});
}
export function markCardPayment(state:Ledger,id:string):Ledger {
 const t=state.transactions.find(t=>t.id===id),a=state.accounts.find(a=>a.id===t?.accountId);
 if(!t||!a||!active(t)||t.transferId||t.refundOf||t.loanOf||state.transactions.some(x=>x.refundOf===id||x.loanOf===id)||!((a.type==='card'&&t.amount>0)||(a.type==='bank'&&t.amount<0)))throw Error('Choose a payment received on a card or sent from a bank. Unlink other relationships first.');
 return {...state,transactions:state.transactions.map(x=>x.id!==id?x:{...x,kind:'transfer',cardPayment:true,category:'Credit card payment',person:'',reason:'Credit card bill payment; excluded from spending and income.'})};
}
export function cardBalance(state:Ledger,account:Account,asOf:string){
 const statement=[...(account.cardStatements||[])].filter(s=>s.closingDate<=asOf).sort((a,b)=>b.closingDate.localeCompare(a.closingDate))[0];
 if(!statement)return null;
 const later=state.transactions.filter(t=>active(t)&&t.accountId===account.id&&t.date>statement.closingDate&&t.date<=asOf);
 const isPayment=(t:Transaction)=>t.amount>0&&t.kind==='transfer'&&(t.cardPayment||!!t.transferId);
 const payments=later.filter(isPayment).reduce((n,t)=>n+t.amount,0);
 const credits=later.filter(t=>t.amount>0&&!isPayment(t)).reduce((n,t)=>n+t.amount,0);
 const charges=later.filter(t=>t.amount<0).reduce((n,t)=>n-t.amount,0);
 return {statement,payments,credits,charges,remaining:Math.max(0,statement.balance-payments),estimated:statement.balance+charges-payments-credits,lastActivity:later.map(t=>t.date).sort().at(-1)||statement.closingDate};
}
