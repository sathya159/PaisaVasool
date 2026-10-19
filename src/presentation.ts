import type {Transaction} from './ledger.ts';
import {canonicalMerchant} from './merchants.ts';

export function activityTitle(t:Transaction){
 const place=t.merchant?.trim()||(t.kind==='loan'?t.person:'')||
  (t.sourceId?t.description:(t.description!==t.reason&&t.description.length<=60?t.description:''));
 return [place?canonicalMerchant(place):'Location needed',t.repaymentType==='split'?'Shared expense repayment':t.category||(t.kind==='unreviewed'?'Needs context':t.kind)].join(' · ');
}

