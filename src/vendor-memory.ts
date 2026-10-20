import {canonicalMerchant} from './merchants.ts';
import type {Transaction,VendorRule} from './ledger.ts';
export function vendorKey(value:string){
 const text=canonicalMerchant(value).toLowerCase().replace(/\b(?:pos|debit card|credit card|card purchase|recurring purchase|purchase|www)\b/g,' ').replace(/\.com\b/g,' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
 const known=text.match(/^(netflix|spotify|chick fil a|costco|target|walmart|wal mart|chipotle|starbucks)\b/);
 return known?known[1].replace('wal mart','walmart'):text.replace(/\s+\d[\w\s]*$/,'').replace(/\s+/g,' ').trim();
}
export function vendorAliases(t:Transaction){return [...new Set([t.merchant,t.description].filter(Boolean).map(x=>vendorKey(x!)).filter(Boolean))];}
export function personalPayment(t:Transaction){return /\b(upi|zelle|venmo|transfer|payment|dad|father|mother|brother|loan|repayment|refund)\b/i.test(t.description);}
export function subscription(t:Transaction){return /subscription|membership|streaming|recurring|monthly plan|annual plan/i.test(t.category+' '+t.reason)||/^(netflix|spotify)$/.test(vendorKey(t.merchant||t.description));}
export function rememberVendor(rules:VendorRule[],t:Transaction):VendorRule[]{
 if(!['expense','income','investment'].includes(t.kind)||personalPayment(t)||!t.category||!t.reason)return rules;
 const aliases=vendorAliases(t);if(!aliases.length)return rules;
 const recurring=subscription(t);
 const matching=rules.filter(r=>r.direction===Math.sign(t.amount)&&r.aliases.some(a=>aliases.includes(a)));
 const allAliases=[...new Set([...aliases,...matching.flatMap(r=>r.aliases)])];
 const next=rules.filter(r=>!(r.direction===Math.sign(t.amount)&&r.aliases.some(a=>allAliases.includes(a))&&(!recurring||r.amount===t.amount&&r.currency===t.currency)));
 return [...next,{aliases:allAliases,direction:Math.sign(t.amount),kind:t.kind as VendorRule['kind'],person:t.person,category:t.category,merchant:t.merchant||t.description,reason:t.reason,...(recurring?{amount:t.amount,currency:t.currency}:{})}];
}
