import {emptyLedger,accounts} from './ledger.ts';
import type {Transaction,Kind} from './ledger.ts';
export function yearDemo(year=2025){
 const state=emptyLedger();state.accounts=[...accounts];state.demo=true;let seed=812;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const add=(month:number,day:number,accountId:string,merchant:string,amount:number,category:string,kind:Kind='expense',person='Me')=>{
  const id='year-demo-'+state.transactions.length;const t:Transaction={id,date:`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`,accountId,currency:accountId==='kotak'?'INR':'USD',merchant,description:merchant,reason:`Sample ${category.toLowerCase()} transaction`,amount:Math.round(amount*100),category,kind,person};state.transactions.push(t);return t;
 };
 for(let m=0;m<12;m++){
  add(m,1,'bofa','Employer payroll',5200,'Salary','income');add(m,2,'bofa','Oakwood Apartments',-1650,'Housing');
  add(m,4,'capitalone','Netflix',-15.49,'Subscriptions');add(m,5,'amex','Netflix',-15.49,'Subscriptions');add(m,6,'amex','Spotify',-11.99,'Subscriptions');add(m,9,'bcu','Comcast',-65,'Utilities');add(m,12,'bcu','Planet Fitness',-24.99,'Fitness');
  add(m,16,'bofa','Electric company',-90-random()*60,'Utilities');add(m,20,'bcu','Vanguard',-450,'Investments','investment');
  for(let i=0;i<16;i++){const shops=[['Costco','Groceries',45,110],['Trader Joe’s','Groceries',25,70],['Chick-fil-A','Dining',9,17],['Chipotle','Dining',12,16],['Target','Household',20,80],['Shell','Transportation',28,30],['Amazon','Shopping',15,100],['Starbucks','Dining',5,8]] as const;const [shop,cat,min,range]=shops[Math.floor(random()*shops.length)];add(m,2+Math.floor(random()*25),i%2?'amex':'capitalone',shop,-min-random()*range,cat);}
  const room=add(m,3,'bcu','Roommate Alex',550,'Housing','refund');room.refundOf=state.transactions.find(t=>t.date.startsWith(`${year}-${String(m+1).padStart(2,'0')}`)&&t.merchant==='Oakwood Apartments')!.id;room.repaymentType='split';const rent=state.transactions.find(t=>t.id===room.refundOf)!;rent.splitOwed=550;rent.splitFrom='Alex';
  add(m,8,'kotak','Father',-8000-random()*4000,'Farming','expense','Father');add(m,14,'kotak','Mother',-1500-random()*2200,'Medical','expense','Mother');
  if(m%3===0)add(m,18,'kotak','Brother',-25000,'Education','expense','Brother');
  if(m===5||m===10){add(m,21,'amex','United Airlines',-340-random()*150,'Travel');add(m,22,'capitalone','Marriott',-280,'Travel');}
  const funding=add(m,5,'bofa','Kotak NRO',-500,'Account transfer','transfer');const received=add(m,7,'kotak','NRO funding',41500,'Account transfer','transfer');funding.transferId=received.transferId='demo-funding-'+m;
 }
 const loan=add(9,4,'bcu','Sunandhan',-800,'Loans lent','loan','Sunandhan');const pay=add(10,15,'bcu','Sunandhan',300,'Loan repayment','loanRepayment','Sunandhan');pay.loanOf=loan.id;
 const shared=add(11,20,'amex','Olive Garden',-120,'Dining');shared.splitOwed=60;shared.splitFrom='Sam';
 return state;
}

