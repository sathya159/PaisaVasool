import {cents,validDate,uid} from './ledger.ts';
import type {Account,Transaction} from './ledger.ts';
export type StatementRow={date:string;description:string;amount:string;currency:string;accountId:string;accountName?:string;accountType?:string;evidence:string};
export type RowIssues=Partial<Record<'date'|'description'|'amount'|'accountId'|'evidence',string>>;
export function statementAccountKey(row:StatementRow){
 return JSON.stringify([row.accountId,row.accountName?.trim().toLowerCase()||'',row.accountType||'',row.currency]);
}
export function assignStatementAccount(rows:StatementRow[],key:string,account:Account):StatementRow[]{
 return rows.map(row=>statementAccountKey(row)===key?{...row,accountId:account.id,currency:account.currency,accountName:account.name,accountType:account.type}:row);
}
export function zeroStatementRow(row:StatementRow){try{return cents(row.amount)===0;}catch{return false;}}
export function statementIssues(row:StatementRow,accounts:Account[]):RowIssues{
 if(zeroStatementRow(row))return {};
 const issues:RowIssues={},account=accounts.find(a=>a.id===row.accountId);
 if(!account||account.currency!==row.currency)issues.accountId='Confirm the account and currency.';
 if(!validDate(row.date))issues.date='Check the date against the statement (YYYY-MM-DD).';
 if(!row.description.trim())issues.description='Enter the transaction description.';
 if(!row.evidence.trim())issues.evidence='Source text is missing. Check the statement.';
 try{cents(row.amount);}catch{issues.amount='Enter a valid transaction amount, for example -24.50.';}
 return issues;
}
export function statementPeriod(rows:StatementRow[]){
 const dates=rows.filter(r=>!zeroStatementRow(r)&&validDate(r.date)).map(r=>r.date).sort();
 return {from:dates[0]||'',to:dates.at(-1)||''};
}
export function statementRows(rows:StatementRow[],accounts:Account[],hash:string):Transaction[]{
 if(!rows.length||rows.length>120)throw Error('No transactions ready to import.');
 return rows.flatMap((r,i):Transaction[]=>{if(zeroStatementRow(r))return [];const issues=statementIssues(r,accounts);if(Object.keys(issues).length)throw Error('Row '+(i+1)+': '+Object.values(issues).join(' '));const a=accounts.find(a=>a.id===r.accountId)!;return [{id:uid(),accountId:a.id,currency:a.currency,date:r.date,description:r.description,amount:cents(r.amount),kind:'unreviewed',person:'',category:'',reason:'',source:'ai-statement',sourceId:hash+':'+i,evidence:r.evidence}];});
}
