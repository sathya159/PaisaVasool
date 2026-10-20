import {vendorAliases,personalPayment,subscription} from './vendor-memory.ts';
import {active,normalize,review,suggest,uid,cents,validDate,isCardBillPayment} from './ledger.ts';
import type {Ledger,Transaction,Account,Kind} from './ledger.ts';
export type Proposal={id:string;kind:'expense'|'income'|'investment'|'unreviewed'|'loan';merchant?:string;match?:'none'|'refund'|'split'|'loan';person:string;category:string;reason:string;question:string;basis:string;confidence:number;};
export function historyFor(state:Ledger,t?:Transaction){
 return state.transactions.filter(x=>active(x)&&!isCardBillPayment(state,x)&&['expense','income','investment'].includes(x.kind)&&x.reason&&x.category)
  .sort((a,b)=>Number(normalize(b.description)===normalize(t?.description||''))-Number(normalize(a.description)===normalize(t?.description||''))||b.date.localeCompare(a.date))
  .slice(0,60).map(x=>({description:x.description,kind:x.kind,person:x.person,category:x.category,reason:x.reason}));
}
export function learnedProposal(state:Ledger,t:Transaction):Proposal|undefined {
 if(!active(t)||isCardBillPayment(state,t)||personalPayment(t)||t.transferId||t.refundOf||t.loanOf)return;
 const aliases=vendorAliases(t),matches=(x:Transaction)=>vendorAliases(x).some(a=>aliases.includes(a));
 const rules=[...(state.vendorRules||[])].reverse().filter(r=>r.direction===Math.sign(t.amount)&&r.aliases.some(a=>aliases.includes(a)));
 if(rules.length){
  const r=rules[0].amount===undefined?rules[0]:rules.find(r=>r.amount===t.amount&&r.currency===t.currency);
  if(!r)return;
  return {id:t.id,kind:r.kind,person:r.person,category:r.category,merchant:r.merchant,reason:r.amount===undefined?(t.reason||(r.kind==='income'?'Income from ':r.kind==='investment'?'Investment with ':'Purchase at ')+r.merchant):r.reason,question:'',basis:r.amount===undefined?'Your confirmed vendor category across accounts':'Your confirmed subscription vendor, amount and currency',confidence:1};
 }
 let past=state.transactions.filter(x=>x.id!==t.id&&active(x)&&!x.classifiedFromHistory&&!isCardBillPayment(state,x)&&matches(x)&&Math.sign(x.amount)===Math.sign(t.amount)&&['expense','income','investment'].includes(x.kind)&&x.category&&x.reason);
 const recurring=past.some(subscription);
 if(recurring)past=past.filter(x=>subscription(x)&&x.amount===t.amount&&x.currency===t.currency);
 if(!past.length||new Set(past.map(x=>[x.kind,normalize(x.person),normalize(x.category),...(recurring?[normalize(x.reason)]:[])].join('|'))).size!==1)return;
 const last=past.sort((a,b)=>b.date.localeCompare(a.date))[0];
 return {id:t.id,kind:last.kind as Proposal['kind'],person:last.person,category:last.category,merchant:last.merchant||last.description,reason:recurring?last.reason:t.reason||(last.kind==='income'?'Income from ':last.kind==='investment'?'Investment with ':'Purchase at ')+(last.merchant||last.description),question:'',basis:recurring?'Your confirmed subscription vendor, amount and currency':'Your confirmed vendor category across accounts',confidence:1};
}
export function validateProposal(value:unknown,t:Transaction):Proposal {
 if(!value||typeof value!=='object')throw Error('AI returned an invalid suggestion.');
 const p=value as Record<string,unknown>;
 if(p.id!==t.id||!['expense','income','investment','unreviewed','loan'].includes(String(p.kind)))throw Error('AI returned an invalid transaction or type.');
 for(const key of ['person','category','reason','question','basis'])if(typeof p[key]!=='string'||(p[key] as string).length>500)throw Error('AI returned an invalid '+key+'.');
 if(p.merchant!==undefined&&(typeof p.merchant!=='string'||p.merchant.length>500))throw Error('Invalid merchant.');
 if(p.kind==='loan'&&(t.amount>=0||!String(p.person).trim()||p.person==='Me'))throw Error('A loan requires the borrower name and money lent out.');
 if(typeof p.confidence!=='number'||p.confidence<0||p.confidence>1)throw Error('Invalid AI confidence.');
 if(p.kind==='expense'&&t.amount>=0||p.kind==='income'&&t.amount<=0)throw Error('Suggested type conflicts with the money direction.');
 if(p.kind!=='unreviewed'&&(!String(p.category).trim()||!String(p.reason).trim()))throw Error('Suggestion needs a category and reason.');
 return p as unknown as Proposal;
}
export function acceptProposals(state:Ledger,proposals:Proposal[],learn=true):Ledger {
 let next=state;
 for(const p of proposals){
  const t=next.transactions.find(x=>x.id===p.id);
  if(!t||t.kind!=='unreviewed'||!active(t)||t.transferId||t.refundOf)throw Error('Transaction changed. Refresh the assistant suggestions.');
  if(p.kind==='unreviewed'||p.question.trim())throw Error('Answer the remaining question before confirming.');
  next=review(next,{...t,kind:p.kind,person:p.person,category:p.category,reason:p.reason,merchant:p.merchant||t.merchant},learn);
 }
 return next;
}
export function reasonOnlyProposal(state:Ledger,t:Transaction,reason:string):Proposal|undefined {
 const s=normalize(reason);
 if(!s)return;
 const person=/\b(for myself|for me|my own expense)\b/.test(s)?'Me':/\b(dad|father)\b/.test(s)?'Father':/\b(mom|mum|mother)\b/.test(s)?'Mother':/\b(brother)\b/.test(s)?'Brother':/\b(sister)\b/.test(s)?'Sister':/\b(parents)\b/.test(s)?'Parents':t.person||'Me';
 const base={id:t.id,person,reason,question:'',basis:'Chosen from your reason and category history',confidence:1};
 if(/\b(refund|reversal|reversed|reimbursement|reimbursed|returned|nro|remittance)\b/.test(s)||/\b(my own|between my|card bill|credit card payment|pay off|paid off)\b/.test(s))return {...base,kind:'unreviewed',category:'',question:'Is this money moving between your accounts, or money returned for an earlier expense? Use the matching action so it is not counted twice.'};
 if(/\b(investment|invested|investing|etf|mutual fund|stocks|brokerage contribution)\b/.test(s))return {...base,kind:'investment',category:'Investments'};
 if(t.amount>0){
  if(/\b(salary|payroll|wages|paycheck)\b/.test(s))return {...base,kind:'income',category:'Salary'};
  if(/\b(dividend|interest)\b/.test(s))return {...base,kind:'income',category:'Investment income'};
  if(/\b(freelance|client|consulting|business income)\b/.test(s))return {...base,kind:'income',category:'Freelance & business'};
  return {...base,kind:'unreviewed',category:'',question:'Was this income, a refund, investment proceeds, or a transfer from your own account?'};
 }
 const saved=state.rules.find(r=>normalize(r.reason)===s&&normalize(r.person)===normalize(person));
 if(saved)return {...base,kind:'expense',category:saved.category,basis:'Your saved category for this reason'};
 const vocabulary:[RegExp,string][]=[
  [/\b(medical|hospital|medicine|medicines|prescription|doctor|clinic|dental|dentist|pharmacy|surgery|treatment)\b/,'Medical'],
  [/\b(farm|farming|seeds|fertilizer|fertiliser|crop|irrigation|tractor)\b/,'Farming'],
  [/\b(college|tuition|education|school|semester|textbooks|university)\b/,'Education'],
  [/\b(rent|mortgage)\b/,'Housing'],
  [/\b(groceries|grocery|vegetables|supermarket|milk|fruit)\b/,'Groceries'],
  [/\b(restaurant|dinner|lunch|breakfast|coffee|takeout|dining|pizza|food)\b/,'Dining'],
  [/\b(gas|petrol|diesel|fuel|uber|lyft|taxi|bus|train|parking|toll)\b/,'Transportation'],
  [/\b(electricity|electric|water bill|internet|wifi|phone bill|utilities)\b/,'Utilities'],
  [/\b(laptop|computer|headphones|electronics|tablet|monitor|iphone)\b/,'Electronics'],
  [/\b(roof|roofing|plumbing|plumber|renovation|home repair|house repair)\b/,'Home repairs'],
  [/\b(car repair|mechanic|tires|tyres|oil change)\b/,'Vehicle maintenance'],
  [/\b(flight|airfare|hotel|vacation|travel)\b/,'Travel'],
  [/\b(insurance|premium)\b/,'Insurance'],
  [/\b(clothes|clothing|shoes|shirt|jeans)\b/,'Clothing'],
  [/\b(gift|birthday|wedding)\b/,'Gifts'],
  [/\b(netflix|spotify|subscription|streaming)\b/,'Subscriptions'],
  [/\b(movie|cinema|concert|entertainment)\b/,'Entertainment'],
  [/\b(gym|fitness|yoga)\b/,'Fitness'],
  [/\b(donation|charity)\b/,'Donations'],
  [/\b(fee|fees|charge)\b/,'Fees']
 ];
 // Reuse established custom categories when the reason explicitly names one.
 const named=state.rules.find(r=>normalize(r.person)===normalize(person)&&normalize(r.category).length>3&&s.includes(normalize(r.category)));
 // Background context ("dinner after a college visit") is not the purchase.
 const purpose=s.split(/\b(?:after|while|during|before)\b/)[0].trim()||s;
 const matched=vocabulary.find(([pattern])=>pattern.test(purpose));
 const historic=matched?state.rules.filter(r=>normalize(r.person)===normalize(person)&&matched[0].test(normalize(r.reason))).map(r=>r.category):[];
 const uniqueHistory=Array.from(new Set(historic));
 let category=named?.category||(uniqueHistory.length===1?uniqueHistory[0]:matched?.[1]);
 if(!category){
  const stop=new Set('i my me for to the a an and of was is it this that paid spent bought buy sent money dad father mom mother brother parents his her their some with on s'.split(' '));
  const words=s.split(' ').filter(w=>!stop.has(w));
  if(!words.length||words.every(w=>['stuff','things','expenses','expense','payment','personal','help','misc','other'].includes(w)))return {...base,kind:'unreviewed',category:'',question:'What did this payment actually cover? For example: medicine, groceries, tuition, or repairs.'};
  category=words.slice(0,5).map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
 }
 const existing=state.transactions.find(old=>normalize(old.category)===normalize(category!))?.category;
 return {...base,kind:'expense',category:existing||category};
}
export type Extracted={date:string;description:string;amount:string;currency:string;evidence:string};
export function extractedTransactions(value:unknown,account:Account,hash:string):Transaction[] {
 if(!Array.isArray(value)||!value.length||value.length>2000)throw Error('No usable transactions were extracted.');
 return value.map((raw,i)=>{
  if(!raw||typeof raw!=='object')throw Error('Invalid extracted row.');
  const row=raw as Extracted;
  if(!validDate(row.date)||typeof row.description!=='string'||!row.description.trim()||row.description.length>500||row.currency!==account.currency||typeof row.amount!=='string'||typeof row.evidence!=='string')throw Error('Extracted row '+(i+1)+' has invalid fields.');
  const amount=cents(row.amount);if(!amount)throw Error('Extracted row has a zero amount.');
  return {id:uid(),accountId:account.id,currency:account.currency,date:row.date,description:row.description,amount,kind:'unreviewed',person:'',category:'',reason:'',source:'ai-statement',sourceId:hash+':'+i,evidence:row.evidence};
 });
}

export function applyKnownHistory(state:Ledger):{state:Ledger;count:number} {
 if(!state.autoClassifyKnown)return {state,count:0};
 let next=state,count=0;
 for(const t of state.transactions.filter(t=>active(t)&&t.kind==='unreviewed'&&!t.reason.trim())){
  const p=learnedProposal(state,t);
  if(p){next=acceptProposals(next,[p],false);next={...next,transactions:next.transactions.map(x=>x.id===t.id?{...x,classifiedFromHistory:true}:x)};count++;}
 }
 return {state:next,count};
}
