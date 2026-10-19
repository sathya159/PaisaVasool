import { cents, uid, validDate } from './ledger.ts';
import type { Account, Transaction } from './ledger.ts';
export function parseCSV(input: string): string[][] {
  const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
  const s=input.replace(/^\uFEFF/,'');
  for(let i=0;i<s.length;i++) {
    const c=s[i];
    if(c==='"') {
      if(quoted && s[i+1]==='"'){cell+='"';i++;}
      else if(quoted || cell==='') quoted=!quoted;
      else throw new Error('Unexpected quote in CSV.');
    } else if(c===','&&!quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted) {
      if(c==='\r'&&s[i+1]==='\n')i++;
      row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';
    } else cell+=c;
  }
  if(quoted) throw new Error('The CSV contains an unclosed quote.');
  row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
  if(rows.length<2) throw new Error('The CSV needs headers and at least one transaction.');
  if(rows.some(r=>r.length!==rows[0].length))throw new Error('CSV rows have inconsistent column counts.');
  return rows;
}
export type Mapping={date:number;description:number;amount:number;debit:number;credit:number;reference:number;format:'MDY'|'DMY'|'ISO';outPositive:boolean};
export function inferMapping(headers:string[]):Mapping {
  const find=(values:string[])=>headers.findIndex(h=>values.includes(h.trim().toLowerCase()));
  return {date:find(['date','transaction date','posted date','posting date']),description:find(['description','payee','merchant','narration','transaction description']),amount:find(['amount','transaction amount']),debit:find(['debit','debits','withdrawal','withdrawals','debit amount']),credit:find(['credit','credits','deposit','deposits','credit amount']),reference:find(['transaction id','reference','reference number','ref no']),format:'ISO',outPositive:false};
}
function parseDate(value:string,format:Mapping['format']) {
  const s=value.trim();
  if(validDate(s))return s;
  if(format==='ISO')throw new Error('Expected YYYY-MM-DD. Choose the statement’s date format.');
  const parts=s.split(/[\/-]/);
  if(parts.length!==3 || !/^\d{4}$/.test(parts[2]))throw new Error('Use a four-digit year.');
  const [month,day]=format==='MDY'?[parts[0],parts[1]]:[parts[1],parts[0]];
  const result=parts[2]+'-'+month.padStart(2,'0')+'-'+day.padStart(2,'0');
  if(!validDate(result))throw new Error('Invalid date: '+s);
  return result;
}
export function csvTransactions(rows:string[][],m:Mapping,account:Account,fileHash:string):Transaction[] {
  if(m.date<0||m.description<0||(m.amount<0 && m.debit<0 && m.credit<0))throw new Error('Map a date, description, and amount (or debit/credit) column.');
  return rows.slice(1).map((r,i)=>{
    try{
      let amount:number;
      if(m.amount>=0) amount=cents(r[m.amount])*(m.outPositive?-1:1);
      else {
        const debit=m.debit>=0&&r[m.debit].trim()?cents(r[m.debit]):0;
        const credit=m.credit>=0&&r[m.credit].trim()?cents(r[m.credit]):0;
        if(debit<0||credit<0|| (debit>0&&credit>0)) throw new Error('Debit and credit columns must be nonnegative, with only one populated.');
        amount=credit-debit;
      }
      if(!amount)throw new Error('Zero-amount row; remove balances and summary rows before importing.');
      const ref=m.reference>=0?r[m.reference].trim():'';
      return {id:uid(),accountId:account.id,currency:account.currency,date:parseDate(r[m.date],m.format),description:r[m.description].trim(),amount,kind:'unreviewed',person:'',category:'',reason:'',source:ref?'statement-reference':'statement-file',sourceId:ref||fileHash+':'+(i+1)};
    }catch(e){throw new Error('Row '+(i+2)+': '+(e as Error).message);}
  });
}

