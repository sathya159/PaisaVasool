import {active,totals} from './ledger.ts';
import type {Ledger,Currency,Transaction} from './ledger.ts';
import {canonicalMerchant} from './merchants.ts';
export function spendingReport(state:Ledger,currency:Currency,year:number,month:number|null,range?:{from:string;to:string}){
 const from=range?.from??`${year}-${String((month??0)+1).padStart(2,'0')}-01`;
 const to=range?.to??(month===null?`${year}-12-31`:`${year}-${String(month+1).padStart(2,'0')}-${new Date(year,month+1,0).getDate()}`);
 const months=Array.from({length:12},(_,i)=>{const prefix=`${year}-${String(i+1).padStart(2,'0')}`;return {month:i,...totals(state,currency,prefix+'-01',prefix+'-31')};});
 const vendors=new Map<string,{name:string;amount:number;visits:number}>(),categories=new Map<string,number>();
 for(const t of state.transactions){
  if(!active(t)||t.currency!==currency||t.date<from||t.date>to||!['expense','refund'].includes(t.kind))continue;
  const original=t.refundOf?state.transactions.find(o=>o.id===t.refundOf):t;
  const name=canonicalMerchant(original?.merchant|| (original?.sourceId?original.description:'Unknown merchant'));
  const v=vendors.get(name)||{name,amount:0,visits:0};v.amount-=t.amount;if(t.kind==='expense')v.visits++;vendors.set(name,v);
  const category=original?.category||t.category||'Other';categories.set(category,(categories.get(category)||0)-t.amount);
 }
 return {from,to,months,total:totals(state,currency,from,to),vendors:[...vendors.values()].sort((a,b)=>b.amount-a.amount),categories:[...categories].map(([name,amount])=>({name,amount})).sort((a,b)=>b.amount-a.amount)};
}
export function recurringPayments(state:Ledger,currency:Currency,through='9999-12-31'){
 const groups=new Map<string,Transaction[]>();
 for(const t of state.transactions){if(!active(t)||t.currency!==currency||t.date>through||t.kind!=='expense'||!t.merchant)continue;const key=canonicalMerchant(t.merchant).toLowerCase();groups.set(key,[...(groups.get(key)||[]),t]);}
 return [...groups.values()].flatMap(rows=>{
  rows.sort((a,b)=>b.date.localeCompare(a.date));const last=rows[0];
  if(!last||['Groceries','Dining','Shopping','Household','Transportation'].includes(last.category))return [];
  const byMonth=new Map<string,Transaction[]>();for(const t of rows){const month=t.date.slice(0,7);byMonth.set(month,[...(byMonth.get(month)||[]),t]);}
  const latest=[...byMonth.keys()].sort((a,b)=>b.localeCompare(a)).slice(0,2);if(latest.length<2)return [];
  const index=(d:string)=>Number(d.slice(0,4))*12+Number(d.slice(5,7));
  const current=byMonth.get(latest[0])!,prior=byMonth.get(latest[1])!;
  if(index(latest[0]+'-01')-index(latest[1]+'-01')!==1||current.length!==prior.length)return [];
  const baseline=Math.abs(current[0].amount),similar=[...current,...prior].every(t=>Math.abs(Math.abs(t.amount)-baseline)<=Math.max(100,baseline*.1));
  if(!similar)return [];
  const monthlyAmount=Math.round(current.reduce((sum,t)=>sum-t.amount,0));
  return [{name:canonicalMerchant(last.merchant!),amount:monthlyAmount,perCharge:Math.round(monthlyAmount/current.length),chargesPerMonth:current.length,accountId:last.accountId,accountIds:[...new Set(current.map(t=>t.accountId))],lastDate:last.date,category:last.category}];
 }).sort((a,b)=>b.amount-a.amount);
}

export function possibleRepeatedCharges(state:Ledger,currency:Currency,from='',to='9999-12-31'){
 const groups=new Map<string,Transaction[]>();
 for(const t of state.transactions){
  if(!active(t)||t.currency!==currency||t.kind!=='expense'||!t.merchant||t.date<from||t.date>to)continue;
  const name=canonicalMerchant(t.merchant),month=t.date.slice(0,7),key=`${name.toLowerCase()}|${t.amount}|${month}`;
  groups.set(key,[...(groups.get(key)||[]),t]);
 }
 return [...groups.values()].filter(rows=>rows.length>1).map(rows=>{
  rows.sort((a,b)=>b.date.localeCompare(a.date));
  return {key:`${canonicalMerchant(rows[0].merchant!).toLowerCase()}|${rows[0].amount}|${rows[0].date.slice(0,7)}`,name:canonicalMerchant(rows[0].merchant!),amount:-rows[0].amount,count:rows.length,month:rows[0].date.slice(0,7),dates:rows.map(t=>t.date),transactionIds:rows.map(t=>t.id),accountIds:[...new Set(rows.map(t=>t.accountId))]};
 }).sort((a,b)=>b.month.localeCompare(a.month)||b.count-a.count||b.amount-a.amount);
}

