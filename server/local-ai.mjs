import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {extractStatement} from './statements.ts';
import {AiError,categorize} from './groq.ts';
// Development only: bind to loopback and reject every other browser origin/Host.
const origin='http://localhost:8081';
let day='',count=0;
createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.headers.host!=='localhost:8787'||req.headers.origin!==origin){res.writeHead(403).end();return;}
 res.setHeader('Access-Control-Allow-Origin',origin);
 res.setHeader('Access-Control-Allow-Headers','content-type');
 res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'}).end(JSON.stringify(data));};
 if(req.method==='GET'&&req.url==='/health'){send(200,{ready:true});return;}
 if(req.method!=='POST'||!['/categorize','/statement'].includes(req.url)){send(404,{error:'Not found'});return;}
 try{
  let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>128000)throw new AiError(413,'Request too large.');}
  const today=new Date().toISOString().slice(0,10);if(day!==today){day=today;count=0;}
  if(++count>100)throw new AiError(429,'Daily local AI limit reached.');
  let input;try{input=JSON.parse(text);}catch{throw new AiError(400,'Invalid JSON.');}
  // Read privately on each request so saving a replacement key needs no restart.
  let key=process.env.GROQ_API_KEY||'';
  try{key=parseEnv(await readFile(new URL('../.env.server',import.meta.url),'utf8')).GROQ_API_KEY||'';}catch(e){if(e.code!=='ENOENT')throw new AiError(503,'Could not read the private backend key file.');}
  send(200,await (req.url==='/statement'?extractStatement(input,key):categorize(input,key)));
 }catch(e){send(e instanceof AiError?e.status:500,{error:e instanceof AiError?e.message:'AI request failed.'});}
}).listen(8787,'127.0.0.1',()=>console.log('Local AI backend: http://localhost:8787 (key and descriptions are never logged)'));

