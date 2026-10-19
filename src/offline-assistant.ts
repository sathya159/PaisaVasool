import {active,normalize} from './ledger.ts';
import type {Ledger,Transaction} from './ledger.ts';
import type {Proposal} from './assistant.ts';
// Only reuse the same stated purpose, merchant/account and direction. Never invent an AI answer.
export function offlineProposal(state:Ledger,t:Transaction,answer:string):Proposal{
 const matches=state.transactions.filter(x=>x.id!==t.id&&active(x)&&x.accountId===t.accountId&&Math.sign(x.amount)===Math.sign(t.amount)&&normalize(x.description)===normalize(t.description)&&normalize(x.reason)===normalize(answer)&&['expense','income','investment','loan'].includes(x.kind));
 if(matches.length&&new Set(matches.map(x=>[x.kind,x.person,x.category,x.merchant].join('|'))).size===1){const previous=matches[0];return {id:t.id,kind:previous.kind as Proposal['kind'],person:previous.person,category:previous.category,merchant:previous.merchant,reason:answer,question:'',basis:'Confirmed history for this exact description and purpose',confidence:1};}
 return {id:t.id,kind:'unreviewed',person:t.person||'Me',category:'',reason:answer,question:'AI is temporarily unavailable. Your description is saved; retry later or adjust the category.',basis:'offline-review',confidence:0};
}

