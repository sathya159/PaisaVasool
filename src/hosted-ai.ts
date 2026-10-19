import {Platform} from 'react-native';
import {cloud} from './cloud';
import {historyFor,validateProposal} from './assistant';
import type {Ledger,Transaction,Account} from './ledger';
// This public switch contains no secret. Local mode is never usable on a hosted site.
const local=Platform.OS==='web'&&typeof window!=='undefined'&&window.location.origin==='http://localhost:8081'&&process.env.EXPO_PUBLIC_LOCAL_AI!=='false';
export const hostedAiConfigured=local||!!cloud;
export function hostedAiStatus(){return {ready:true,engine:'Groq AI',message:local?'Groq AI · local backend. Descriptions and up to 12 relevant past entries are sent to Groq when you save. Backend setup is required; see AI-SETUP.md.':'Groq AI · sign in to categorize. Descriptions and up to 12 relevant past entries are sent to Groq when you save. Requires the deployed AI function.'};}
export async function classifyHosted(state:Ledger,tx:Transaction,answer:string){
 const payload={transaction:{description:tx.description.slice(0,500),amount:tx.amount,currency:tx.currency},answer:answer.trim(),history:historyFor(state,tx).filter(h=>h.reason!==answer).slice(0,12).map(h=>({...h,description:h.description.slice(0,500),reason:h.reason.slice(0,500),person:h.person.slice(0,500),category:h.category.slice(0,500)}))};
 if(payload.answer.length>500)throw Error('Please keep your description under 500 characters.');
 let data:any;
 if(local){
  let response:Response;try{response=await fetch('http://localhost:8787/categorize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});}catch{throw Error('Start the local AI backend using AI-SETUP.md, then try again. Nothing was saved.');}
  data=await response.json();if(!response.ok)throw Error(data.error||'AI unavailable. Nothing was saved.');
 }else{
  if(!cloud)throw Error('Configure the AI backend first.');
  const {data:session}=await cloud.auth.getSession();if(!session.session)throw Error('Sign in to use Groq AI.');
  const result=await cloud.functions.invoke('categorize',{body:payload});
  if(result.error){let message='AI unavailable. Check AI-SETUP.md or try again later. Nothing was saved.';try{message=(await result.error.context.json()).error||message;}catch{}throw Error(message);}
  data=result.data;
 }
 return validateProposal({...data,id:tx.id},tx);
}

export async function readHostedStatement(text:string,accounts:Account[]=[]){
 if(local){const r=await fetch('http://localhost:8787/statement',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,accounts}),signal:AbortSignal.timeout(65000)});const data=await r.json();if(!r.ok)throw Error(data.error||'Statement reading failed.');return data;}
 if(!cloud)throw Error('Configure Groq first.');const {data,error}=await cloud.functions.invoke('categorize',{body:{operation:'statement',text,accounts}});if(error)throw Error('Statement AI unavailable. Check the deployed function and sign in.');return data;
}

