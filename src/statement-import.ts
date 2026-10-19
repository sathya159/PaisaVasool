import {cents,validDate,uid} from './ledger.ts';
import type {Account,Transaction} from './ledger.ts';
export type StatementRow={date:string;description:string;amount:string;currency:string;accountId:string;accountName?:string;accountType?:string;evidence:string};
export function statementRows(rows:StatementRow[],accounts:Account[],hash:string):Transaction[]{
 if(!rows.length||rows.length>120)throw Error('No transactions ready to import.');
 return rows.map((r,i)=>{const a=accounts.find(a=>a.id===r.accountId);if(!a||a.currency!==r.currency)throw Error('Confirm the account and currency for row '+(i+1)+'.');if(!validDate(r.date)||!r.description.trim()||!r.evidence.trim())throw Error('Check the date and description on row '+(i+1)+'.');const amount=cents(r.amount);if(!amount)throw Error('Zero amount on row '+(i+1));return {id:uid(),accountId:a.id,currency:a.currency,date:r.date,description:r.description,amount,kind:'unreviewed',person:'',category:'',reason:'',source:'ai-statement',sourceId:hash+':'+i,evidence:r.evidence};});
}

