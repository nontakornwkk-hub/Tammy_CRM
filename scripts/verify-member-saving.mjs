import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(file, deps, globals = {}) {
  deps["@/lib/line/test-catalog"] = { prepareTestItem: async () => null };
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
    {exports,require:name=>{if (!(name in deps)) throw Error(name); return deps[name];},Response,Request,URLSearchParams,AbortSignal,performance,console,...globals});
  return exports;
}
const userId = 'U'+'a'.repeat(32);
for (const bad of [null,'channel','expiry','scope','profile']) {
  const started=[];
  let release;
  const gate=new Promise(resolve=>{release=resolve;});
  const {verifyMemberIdentity}=load('lib/line/verify-member-identity.ts',{'server-only':{}},{fetch:async url=>{
    started.push(url); await gate;
    return Response.json(url.includes('/v2/profile')?{userId:bad==='profile'?'invalid':userId}:{client_id:bad==='channel'?'wrong':'channel',expires_in:bad==='expiry'?0:600,scope:bad==='scope'?'openid':'profile'});
  }});
  const result=verifyMemberIdentity({accessToken:'valid-token-for-test-123456'},'channel');
  assert.equal(started.length,2,'Verify and profile must start together');release();
  assert.equal(Boolean(await result),bad===null,'Invalid token metadata or profile must be denied');
}
const itemId='11111111-1111-4111-8111-111111111111';
const requestId='22222222-2222-4222-8222-222222222222';
const request=()=>new Request('http://localhost/api/line/member/redeem',{method:'POST',body:JSON.stringify({kind:'reward',itemId,requestId,accessToken:'test-token'})});
for (const result of [{data:[{redemption_id:'saved',remaining_points:50}],error:null},{data:null,error:{message:'OUT_OF_STOCK'}},{data:[],error:null}]) {
  let calls=0,release;
  const gate=new Promise(resolve=>{release=resolve;});
  const route=load('app/api/line/member/redeem/route.ts',{'@/lib/line/member-session':{verifiedMemberSession:async()=>({ownerId:'owner',memberId:'member',db:{rpc:async(name,args)=>{
    assert.equal(name,'redeem_line_member_item');assert.equal(args.p_request_id,requestId);calls++;await gate;return result;
  }}})}});
  let settled=false;const responsePromise=route.POST(request()).then(value=>{settled=true;return value;});
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(settled,false,'Never acknowledge success before commit');release();
  const response=await responsePromise;const body=await response.json();
  assert.equal(calls,1);assert.equal(Boolean(body.success),Boolean(result.data?.[0]?.redemption_id));
  if(body.success){assert.equal(body.points,50);assert.match(response.headers.get('server-timing'),/auth;dur=.*write;dur=/);}
  else assert.ok(response.status>=400);
}
const denied=load('app/api/line/member/redeem/route.ts',{'@/lib/line/member-session':{verifiedMemberSession:async()=>({error:'Denied',status:401})}});
assert.equal((await denied.POST(request())).status,401);
for(const birth_date_changed_at of [new Date().toISOString(),null]) {
  const filters=[];
  const query={update(changes){assert.equal(changes.birth_date,'1995-05-16');return this;},eq(key,value){filters.push([key,value]);return this;},or(value){filters.push(['or',value]);return this;},select(){return this;},async maybeSingle(){return{data:null,error:null};}};
  let writes=0;
  const route=load('app/api/line/member/account/route.ts',{'@/lib/line/member-session':{verifiedMemberSession:async()=>({ownerId:'owner',memberId:'member',birthday:{birth_date:'1995-05-15',birth_date_changed_at},db:{from(){writes++;return query;}}})}});
  const response=await route.POST(new Request('http://localhost/api/line/member/account',{method:'POST',body:JSON.stringify({action:'update',profile:{firstName:'Test',lastName:'Member',phone:'0812345678',birthDate:'1995-05-16'}})}));
  assert.equal(response.status,409);
  assert.equal(writes,birth_date_changed_at?0:1);
  if(!birth_date_changed_at){assert.ok(filters.some(([key])=>key==='or'));assert.ok(filters.some(([key,value])=>key==='birth_date'&&value==='1995-05-15'),'Concurrent birthday updates must match the old value');}
}
console.log('PASS: parallel LINE verification retains identity guards; reward success waits for committed RPC; stock/error/unauthorized failures; annual and concurrent birthday protections.');
