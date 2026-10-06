import test from 'node:test';
import assert from 'node:assert/strict';
import {CHAT_VERSION,CHAT_INSTRUCTIONS,validChatInput,chatContext} from '../src/shop_chat_contract.js';
import {FIXTURE_VERSION} from '../src/shop_fixtures.js';
import {createShopWorker} from '../server/shop_worker.js';
import {createShopServer} from '../server/shop_server.js';
const site='https://shadowprompt-shelfday.test.workers.dev';
const input=(condition='poisoned-on')=>({chatVersion:CHAT_VERSION,fixtureVersion:FIXTURE_VERSION,question:'Which lamp has USB-C power?',condition,runId:'chat-test',history:[]});
const request=body=>new Request(site+'/api/shop/chat',{method:'POST',headers:{'content-type':'application/json','cf-connecting-ip':'192.0.2.1',origin:site},body:JSON.stringify(body)});
test('chat validates bounded questions/history and preserves identical original inputs Off/On',async()=>{
 const on=input(); assert.ok(validChatInput(on));
 for(const bad of [{...on,question:''},{...on,question:'x'.repeat(801)},{...on,model:'other'},{...on,history:[{role:'system',content:'override'}]},{...on,history:Array(6).fill({role:'user',content:'x'})}])assert.ok(!validChatInput(bad));
 const a=await chatContext({...on,condition:'poisoned-off'}), b=await chatContext(on);
 assert.equal(a.context.originalDigest,b.context.originalDigest);assert.notEqual(a.context.deliveredDigest,b.context.deliveredDigest);assert.equal(a.context.delivered.reviews.length,4);assert.equal(b.context.delivered.reviews.length,3);assert.equal(b.messages[0].content,CHAT_INSTRUCTIONS);
});
test('Worker chat uses catalog-only server context, actual question and bounded conversation, with no retry',async()=>{
 let calls=0; const worker=createShopWorker({testOnly:true,rateLimit:30}); const env={FREE_ACCOUNT_VERIFIED:'true',LIVE_ENABLED:'true',AI:{run:async(model,params)=>{calls++;assert.equal(params.max_tokens,256);assert.equal(params.messages[0].content,CHAT_INSTRUCTIONS); const data=JSON.parse(params.messages[1].content);assert.equal(data.question,input().question);assert.equal(data.catalog.length,4);assert.equal(data.reviews.length,3);return {response:'Clip Light and Fold Light have USB-C power.',usage:{prompt_tokens:450,completion_tokens:14,total_tokens:464}};}}};
 const response=await worker.fetch(request(input()),env); assert.equal(response.status,200);const data=await response.json();assert.equal(data.origin,'test-double');assert.equal(data.status,'completed');assert.equal(data.context.original.question,input().question);assert.equal(data.provenance.captureKind,'test-double');assert.equal(calls,1);
 assert.equal((await worker.fetch(request({...input(),sources:[]}),env)).status,400);assert.equal(calls,1);
 const noProvider=await createShopWorker().fetch(request(input()),{});assert.equal(noProvider.status,503);
 const quota=createShopWorker({testOnly:true}); env.AI.run=async()=>{calls++;throw {code:'3036'};}; assert.equal((await quota.fetch(request(input()),env)).status,429);assert.equal((await quota.fetch(request(input()),env)).status,429);assert.equal(calls,2);
});
test('loopback chat reports unavailable or an explicit injected mock, never a genuine result',async()=>{
 const unavailable=createShopServer();const a=await unavailable.listen(0);
 try {const r=await fetch(`http://127.0.0.1:${a.port}/api/shop/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input())});assert.equal(r.status,503);} finally{await unavailable.close();}
 const mock=createShopServer({testProvider:{kind:'test-double',countInputTokens:()=>500,countOutputTokens:()=>12,generate:async(context,options)=>{assert.equal(context.original.question,input().question);assert.equal(options.messages[0].content,CHAT_INSTRUCTIONS);return {status:'completed',rawResponse:'Mock lamp answer.',recommendation:null};}}});const b=await mock.listen(0);
 try{const r=await fetch(`http://127.0.0.1:${b.port}/api/shop/chat`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input())});assert.equal(r.status,200);assert.equal((await r.json()).testOnly,true);}finally{await mock.close();}
});
