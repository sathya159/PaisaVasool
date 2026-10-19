import {requireOptionalNativeModule} from 'expo';
import type {Ledger,Transaction,Account} from './ledger';
import {historyFor,validateProposal,extractedTransactions} from './assistant';
type Bridge={status:()=>Promise<{ready:boolean;message:string;engine:string}>;classify:(input:string)=>Promise<string>;extract:(uri:string,currency:string)=>Promise<string>;addListener:(event:string,listener:(event:{message:string})=>void)=>{remove:()=>void}};
const native=requireOptionalNativeModule<Bridge>('KinledgerAssistant');
export async function assistantStatus(){
 return native?native.status():{ready:false,engine:'Saved history',message:'Apple AI runs in the native iPhone app with iOS 26+ and Apple Intelligence enabled. This browser preview uses saved history and simple reason matching only.'};
}
export async function classifyOnPhone(state:Ledger,tx:Transaction,answer:string){
 if(!native)throw Error('Apple on-device AI is not available in the browser preview.');
 const history=historyFor(state,tx).slice(0,8);
 const raw=JSON.parse(await native.classify(JSON.stringify({transaction:{description:tx.description,amount:tx.amount,currency:tx.currency},answer,history})));
 return validateProposal({...raw,id:tx.id,confidence:.5},tx);
}
export async function extractOnPhone(uri:string,account:Account,hash:string,onProgress:(s:string)=>void){
 if(!native)throw Error('PDF/image AI reading requires the native iPhone build. CSV import remains available in this preview.');
 const listener=native.addListener('onProgress',event=>onProgress(event.message));
 try {
  const value=JSON.parse(await native.extract(uri,account.currency));
  return {rows:extractedTransactions(value.rows,account,hash),warnings:Array.isArray(value.warnings)?value.warnings.filter((s:unknown)=>typeof s==='string'):[],pages:value.pages};
 }finally{listener.remove();}
}

