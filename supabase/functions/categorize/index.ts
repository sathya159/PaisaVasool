import {extractStatement} from '../../../server/statements.ts';
import {AiError,categorize,cleanInput} from '../../../server/groq.ts';

Deno.serve(async(req:Request)=>{
 const origin=Deno.env.get('AI_ALLOWED_ORIGIN');
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin||'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const reply=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers});
 if(!origin||req.headers.get('origin')!==origin)return reply(403,{error:'This website is not allowed to use the AI backend.'});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply(405,{error:'POST required.'});
 try{
  const url=Deno.env.get('SUPABASE_URL')!;
  const token=req.headers.get('authorization')||'';
  if(!token.startsWith('Bearer '))throw new AiError(401,'Sign in to use AI.');
  const userResponse=await fetch(url+'/auth/v1/user',{headers:{apikey:Deno.env.get('SUPABASE_ANON_KEY')!,Authorization:token},signal:AbortSignal.timeout(10000)});
  if(!userResponse.ok)throw new AiError(401,'Sign in again to use AI.');
  const user=await userResponse.json();if(!user.id)throw new AiError(401,'Sign in again.');
  let text='';const reader=req.body?.getReader();if(!reader)throw new AiError(400,'Missing request.');
  const decoder=new TextDecoder();let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>128000){await reader.cancel();throw new AiError(413,'Request too large.');}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
  let input;try{const parsed=JSON.parse(text);input=parsed.operation==='statement'?parsed:cleanInput(parsed);}catch{throw new AiError(400,'Invalid transaction description or history.');}
  if(!Deno.env.get('GROQ_API_KEY'))throw new AiError(503,'Add GROQ_API_KEY in Supabase function secrets first.');
  // Atomic database quota persists across function instances. Browser cannot call this RPC.
  const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const quota=await fetch(url+'/rest/v1/rpc/consume_ai_quota',{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify({owner_id:user.id}),signal:AbortSignal.timeout(10000)});
  if(!quota.ok)throw new AiError(503,'AI usage limits are not configured. Run supabase/ai-quota.sql.');
  if(await quota.json()!==true)throw new AiError(429,'Daily AI allowance reached. Try tomorrow or adjust the category manually.');
  return reply(200,await (input.operation==='statement'?extractStatement(input,Deno.env.get('GROQ_API_KEY')!):categorize(input,Deno.env.get('GROQ_API_KEY')!)));
 }catch(e){return reply(e instanceof AiError?e.status:503,{error:e instanceof AiError?e.message:'AI unavailable. Nothing was saved; try again later.'});}
});

