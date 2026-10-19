export type Currency = 'USD' | 'INR';
export type Kind = 'unreviewed' | 'expense' | 'income' | 'investment' | 'transfer' | 'refund' | 'familyfund' | 'loan' | 'loanRepayment';
export type Account = { id: string; name: string; currency: Currency; type: 'bank' | 'card' | 'fund'; addedByUser?: boolean };
export type Transaction = {
  id: string; accountId: string; date: string; description: string; amount: number;
  currency: Currency; kind: Kind; person: string; category: string; reason: string;
  merchant?: string; sourceId?: string; source?: string; duplicateOf?: string; ignored?: boolean;
  loanOf?: string; repaymentType?: 'split'; splitOwed?: number; splitFrom?: string;
  transferId?: string; refundOf?: string; evidence?: string; classifiedFromHistory?: boolean;
};
export type Rule = { reason: string; person: string; category: string };
export type Ledger = { version: 1; accountSetupVersion?: number; demo?: boolean; autoClassifyKnown?: boolean; accounts: Account[]; transactions: Transaction[]; rules: Rule[] };
export const accounts: Account[] = [
  {id:'bofa',name:'Bank of America',currency:'USD',type:'bank'},
  {id:'bcu',name:'BCU Checking',currency:'USD',type:'bank'},
  {id:'amex',name:'American Express',currency:'USD',type:'card'},
  {id:'capitalone',name:'Capital One',currency:'USD',type:'card'},
  {id:'kotak',name:'Kotak NRO',currency:'INR',type:'bank'},
  {id:'parents-fund',name:'Parents’ held fund',currency:'INR',type:'fund'},
  {id:'brother-fund',name:'Brother’s held fund',currency:'INR',type:'fund'},
  {id:'bcu-card',name:'BCU Credit Card',currency:'USD',type:'card'},
];
export const emptyLedger = (): Ledger => ({version:1, accountSetupVersion:2, autoClassifyKnown:true, accounts:[], transactions:[], rules:[]});
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const normalize = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function cents(value: string): number {
  const cleaned = value.trim().replace(/[,₹$\s]/g,'').replace(/^\((.*)\)$/,'-$1');
  if (!/^[+-]?\d+(\.\d{1,2})?$/.test(cleaned)) throw new Error('Use a valid amount with at most two decimal places.');
  const negative = cleaned.startsWith('-');
  const [whole, fraction=''] = cleaned.replace(/^[+-]/,'').split('.');
  const result = Number(whole)*100 + Number(fraction.padEnd(2,'0'));
  if (!Number.isSafeInteger(result)) throw new Error('Amount is too large.');
  return negative ? -result : result;
}
export function validDate(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
}
export function validate(t: Transaction, state: Ledger) {
  if (!state.accounts.some(a=>a.id===t.accountId && a.currency===t.currency)) throw new Error('Account and currency do not match.');
  if (!validDate(t.date)) throw new Error('Use a real date in YYYY-MM-DD format.');
  if (!Number.isSafeInteger(t.amount) || t.amount===0) throw new Error('Amount must be non-zero.');
  if (!t.description.trim()) throw new Error('Enter where the transaction happened.');
  if (t.kind==='loan' && (t.amount>=0||!t.person.trim()||t.person==='Me')) throw new Error('A loan needs money lent out and the borrower’s name.');
  if (t.kind==='expense' && t.amount>=0) throw new Error('An expense must be money out.');
  if ((t.kind==='income'||t.kind==='refund') && t.amount<=0) throw new Error('Income and refunds must be money in.');
}
export function importRows(state: Ledger, rows: Transaction[], from: string, to: string) {
  if (!validDate(from)||!validDate(to)||from>to) throw new Error('Choose a valid start and end date.');
  const transactions = [...state.transactions]; let skipped=0, added=0, possible=0, outside=0;
  for (const row of rows) {
    validate(row,state);
    if (row.date<from || row.date>to) {outside++;continue;}
    if (row.sourceId && transactions.some(t=>t.accountId===row.accountId && t.source===row.source && t.sourceId===row.sourceId)) {skipped++;continue;}
    const match = transactions.find(t=>!t.ignored && t.accountId===row.accountId && t.date===row.date && t.amount===row.amount && normalize(t.description)===normalize(row.description));
    transactions.push({...row, duplicateOf:match?.id, kind:'unreviewed'});
    added++; if(match) possible++;
  }
  return {state:{...state,transactions},added,skipped,possible,outside};
}
export const active = (t: Transaction) => !t.ignored && !t.duplicateOf;
export function totals(state: Ledger, currency: Currency, from='', to='9999-12-31', person?: string) {
  let expense=0,income=0,invested=0,withdrawn=0,lent=0,review=0;
  for(const t of state.transactions) {
    if(!active(t)||t.currency!==currency||t.date<from||t.date>to) continue;
    if(t.kind==='unreviewed') {review++;continue;}
    const original = t.refundOf ? state.transactions.find(o=>o.id===t.refundOf) : undefined;
    if(person && (original?.person||t.person)!==person) continue;
    if(t.kind==='loan') lent-=t.amount;
    if(t.kind==='expense') expense-=t.amount;
    if(t.kind==='refund') expense-=t.amount;
    if(t.kind==='income') income+=t.amount;
    if(t.kind==='investment') { if(t.amount<0) invested-=t.amount; else withdrawn+=t.amount; }
  }
  return {expense,income,invested,withdrawn,lent,review};
}
export function linkTransfer(state: Ledger, aId: string, bId: string): Ledger {
  const a=state.transactions.find(t=>t.id===aId),b=state.transactions.find(t=>t.id===bId);
  if(!a||!b||a.id===b.id||a.accountId===b.accountId||a.amount*b.amount>=0||!active(a)||!active(b)) throw new Error('Choose opposite-direction transactions in two different accounts.');
  if(a.transferId||b.transferId||a.refundOf||b.refundOf||a.loanOf||b.loanOf||state.transactions.some(t=>t.refundOf===a.id||t.refundOf===b.id||t.loanOf===a.id||t.loanOf===b.id)) throw new Error('Unlink existing relationships first.');
  if(a.currency===b.currency && a.amount!==-b.amount) throw new Error('Same-currency transfer amounts must match. Record fees separately.');
  const transferId=uid();
  return {...state,transactions:state.transactions.map(t=>t.id===aId||t.id===bId?{...t,kind:'transfer',transferId,category:'Account transfer',person:'',reason:'Matched account transfer'}:t)};
}
export function linkRefund(state: Ledger, refundId: string, expenseId: string): Ledger {
  const r=state.transactions.find(t=>t.id===refundId),e=state.transactions.find(t=>t.id===expenseId);
  if(!r||!e||r.id===e.id||r.amount<=0||e.kind!=='expense'||e.amount>=0||r.currency!==e.currency||!active(r)||!active(e)||r.transferId||r.refundOf||r.loanOf) throw new Error('Choose a credit and an expense in the same currency.');
  if(r.date<e.date) throw new Error('The refund cannot predate the expense.');
  const refunded=state.transactions.filter(t=>active(t)&&t.refundOf===e.id).reduce((sum,t)=>sum+t.amount,0);
  if(refunded+r.amount>-e.amount) throw new Error('The linked refunds exceed the original expense.');
  return {...state,transactions:state.transactions.map(t=>t.id===r.id?{...t,kind:'refund',refundOf:e.id,category:e.category,person:e.person,reason:'Refund: '+e.description}:t)};
}
export function unlink(state: Ledger,id: string): Ledger {
  const target=state.transactions.find(t=>t.id===id);
  return {...state,transactions:state.transactions.map(t=>
    (t.id===id || (target?.transferId && t.transferId===target.transferId) || t.refundOf===id || t.loanOf===id)
      ? {...t,kind:'unreviewed',transferId:undefined,refundOf:undefined,loanOf:undefined,repaymentType:undefined} : t)};
}
export function review(state: Ledger, tx: Transaction): Ledger {
  validate(tx,state);
  const old=state.transactions.find(t=>t.id===tx.id);
  if(old?.transferId||old?.refundOf||old?.loanOf||state.transactions.some(t=>t.refundOf===tx.id||t.loanOf===tx.id)) throw new Error('Unlink this transaction before changing its classification.');
  if(tx.kind==='refund'||tx.kind==='transfer'||tx.kind==='loanRepayment') throw new Error('Use the matching action to link both transactions.');
  if(tx.kind!=='unreviewed' && (!tx.category.trim()||!tx.reason.trim())) throw new Error('Add a category and a reason.');
  const category=state.transactions.find(t=>normalize(t.category)===normalize(tx.category))?.category || tx.category.trim();
  const updated={...tx,category,person:tx.person.trim(),reason:tx.reason.trim()};
  const rules=tx.reason.trim() && tx.kind==='expense'
    ? [...state.rules.filter(r=>normalize(r.reason)!==normalize(tx.reason)||normalize(r.person)!==normalize(tx.person)),{reason:tx.reason.trim(),person:tx.person.trim(),category}]
    : state.rules;
  return {...state,rules,transactions:old?state.transactions.map(t=>t.id===tx.id?updated:t):[...state.transactions,updated]};
}
export function suggest(state: Ledger, reason: string, person: string) {
  const learned=state.rules.find(r=>normalize(r.reason)===normalize(reason)&&normalize(r.person)===normalize(person));
  if(learned) return learned.category;
  const s=normalize(reason);
  if(/\b(farm|farming|seeds|fertilizer|crop)\b/.test(s)) return 'Farming';
  if(/\b(medical|hospital|medicine|doctor)\b/.test(s)) return 'Medical';
  if(/\b(college|tuition|education|school)\b/.test(s)) return 'Education';
  if(/\b(grocery|groceries|food)\b/.test(s)) return 'Groceries';
  if(/\b(rent|housing)\b/.test(s)) return 'Housing';
  return '';
}
export function demoLedger(): Ledger {
  const state=emptyLedger(); state.accounts=[...accounts]; state.demo=true;
  const make=(id:string,accountId:string,date:string,description:string,amount:number,kind:Kind,category='',person='',reason=''):Transaction=>({id,accountId,date,description,amount,currency:accounts.find(a=>a.id===accountId)!.currency,kind,category,person,reason});
  state.transactions=[
    make('salary','bofa','2026-09-01','Salary',420000,'income','Salary','Me','Monthly salary'),
    {...make('wire','bofa','2026-09-03','Transfer to Kotak NRO',-200000,'transfer','Account transfer'),transferId:'demo-transfer'},
    {...make('nro','kotak','2026-09-05','Remittance received',16600000,'transfer','Account transfer'),transferId:'demo-transfer'},
    make('farm','kotak','2026-09-08','Dad • farming supplies',-1500000,'expense','Farming','Father','Farming supplies'),
    make('college','kotak','2026-09-10','Brother • college fees',-2500000,'expense','Education','Brother','College tuition'),
    make('shop','amex','2026-09-12','Target',-12849,'expense','Household','Me','Household supplies'),
    {...make('refund','amex','2026-09-15','Target return',3500,'refund','Household','Me'),refundOf:'shop'},
    make('doctor','kotak','2026-09-17','UPI • clinic',-450000,'unreviewed'),
    make('invest','bcu','2026-09-18','Investment contribution',-50000,'investment','Investments','Me','Monthly contribution'),
    make('dining','capitalone','2026-09-19','Restaurant',-4275,'unreviewed'),
  ];
  return state;
}


export function updateAccounts(state:Ledger):Ledger {
 const used=new Set(state.transactions.map(t=>t.accountId));
 const kept=state.accounts.filter(a=>state.accountSetupVersion===2||a.addedByUser||used.has(a.id)||!accounts.some(seed=>seed.id===a.id&&seed.name===a.name));
 return {...state,accountSetupVersion:2,autoClassifyKnown:true,accounts:kept.map(a=>a.id==='bcu'&&a.name==='BCU'?{...a,name:'BCU Checking'}:a)};
}

