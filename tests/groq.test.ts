import test from 'node:test';
import assert from 'node:assert/strict';
import {categorize,cleanInput} from '../server/groq.ts';
const input={transaction:{description:'Dinner',amount:-1500,currency:'USD',accountNumber:'MUST-NOT-SEND'},answer:'Dinner for myself',history:[]};
const proposal={match:'none',kind:'expense',person:'Me',merchant:'Olive Garden',category:'Dining',reason:'Dinner for myself',question:'',basis:'Dinner',confidence:'high'};
const mock=(p:unknown):typeof fetch=>async()=>Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(p)}}]});
test('request sends only allowed transaction fields and uses backend authorization',async()=>{
 let calls=0;
 const result=await categorize(input,'test-only-key',async(url,init)=>{
  calls++;assert.equal(url,'https://api.groq.com/openai/v1/chat/completions');
  assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer test-only-key');
  const body=JSON.parse(String(init?.body));
  assert.equal(body.response_format.json_schema.strict,true);
  assert.ok(!String(init?.body).includes('MUST-NOT-SEND'));
  assert.ok(!String(init?.body).includes('test-only-key'));
  return mock(proposal)(url,init);
 });
 assert.equal(calls,1);assert.equal(result.category,'Dining');
});
test('missing key never invokes provider',async()=>{
 await assert.rejects(categorize(input,'',async()=>{assert.fail('Must not call Groq');}),/not configured/);
});
test('invalid or excessive input is rejected before provider call',()=>{
 for(const bad of [{...input,answer:'x'.repeat(501)},{...input,history:Array(13).fill({})},{...input,transaction:{...input.transaction,amount:NaN}},{...input,history:[null]}])assert.throws(()=>cleanInput(bad));
});
test('quota failure is actionable and does not leak upstream response',async()=>{
 await assert.rejects(categorize(input,'test',async()=>new Response('private diagnostic',{status:429})),/Free AI limit reached/);
});
test('wrong money direction and malformed outputs cannot reach ledger',async()=>{
 for(const bad of [{...proposal,kind:'income'},{...proposal,confidence:2},{...proposal,category:''},{...proposal,reason:5}])await assert.rejects(categorize(input,'test',mock(bad)),/unusable/);
 await assert.rejects(categorize(input,'test',async()=>Response.json({choices:[{finish_reason:'length',message:{content:JSON.stringify(proposal)}}]})),/unusable/);
});
test('uncertain suggestions require clarification instead of auto-saving',async()=>{
 const p=await categorize(input,'test',mock({...proposal,confidence:'low'}));
 assert.equal(p.kind,'unreviewed');assert.ok(p.question);
});
test('transfer and refund clarification remains unreviewed',async()=>{
 const p=await categorize(input,'test',mock({...proposal,kind:'unreviewed',category:'',question:'Match this to your own account transfer.'}));
 assert.equal(p.kind,'unreviewed');assert.match(String(p.question),/Match/);
});
test('provider network failure gives safe retry message',async()=>{
 await assert.rejects(categorize(input,'test',async()=>{throw Error('secret provider debug');}),/has not been changed/);
});
test('missing expense location asks where, without inventing a merchant',async()=>{
 const p=await categorize(input,'test',mock({...proposal,merchant:''}));
 assert.equal(p.kind,'unreviewed');assert.match(String(p.question),/Where did you spend/);
});
test('a named loan has a separate classification and rejects received money',async()=>{
 const loan={...proposal,kind:'loan',person:'Sunandhan',merchant:'Sunandhan',category:'Loans lent'};
 const p=await categorize(input,'test',mock(loan));assert.equal(p.kind,'loan');assert.equal(p.question,'');
 await assert.rejects(categorize({...input,transaction:{...input.transaction,amount:100}},'test',mock(loan)),/unusable/);
});

