import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function load(file,deps,extra={}) { const exports={};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in deps))throw Error(n);return deps[n];},Request,Response,AbortSignal,Date,console,...extra});return exports; }
const singleFlight=load('lib/single-flight.ts',{}).singleFlight;
let calls=0,release;
let gate=new Promise(r=>release=r);
const cache=load('lib/customer-catalog.ts',{'./single-flight':{singleFlight}},{fetch:async()=>{calls++;await gate;return Response.json({coupons:[{id:'one'}],rewards:[]});}});
const a=cache.loadMemberCatalog('member-a'),b=cache.loadMemberCatalog('member-a');
await new Promise(r=>setTimeout(r,0));assert.equal(calls,1);release();await Promise.all([a,b]);
assert.equal(cache.cachedMemberCatalog('member-a').coupons[0].id,'one');assert.equal(cache.cachedMemberCatalog('member-b'),undefined);
await cache.loadMemberCatalog('member-a');assert.equal(calls,2,'Background refresh must hit server');
cache.clearMemberCatalog();assert.equal(cache.cachedMemberCatalog('member-a'),undefined);
let start=[],resolve;const dbGate=new Promise(r=>resolve=r);
function query(table) { const q={select(){return q},eq(){return q},order(){return q},not(){return q},maybeSingle(){return q},then(fn){start.push(table);return dbGate.then(()=>fn({error:null,data:table==='members'?{spending:0,level:'Member'}:table==='store_settings'?{extra:{}}:table==='coupons'?[{id:'public',audience_mode:'public',stock:null,usage_limit:null,starts_at:null,ends_at:null},{id:'private',audience_mode:'targeted',usage_limit:null,starts_at:null,ends_at:null}]:[]}));}};return q; }
const route=load('app/api/line/member/catalog/route.ts',{'@/lib/line/member-session':{verifiedMemberSession:async()=>({db:{from:query},ownerId:'owner',memberId:'member'})}});
const result=route.POST(new Request('http://localhost/catalog',{method:'POST',body:'{}'}));
await new Promise(r=>setTimeout(r,0));assert.equal(start.length,6,'All six independent reads must begin before any completes');resolve();
const body=await (await result).json();assert.deepEqual(body.coupons.map(x=>x.id),['public'],'Targeted coupons cannot leak');assert.equal(body.rankProgress.next,'Gold');
const denied=load('app/api/line/member/catalog/route.ts',{'@/lib/line/member-session':{verifiedMemberSession:async()=>({error:'Denied',status:401})}});
assert.equal((await denied.POST(new Request('http://localhost/catalog',{method:'POST',body:'{}'}))).status,401);
console.log('PASS: catalog prefetch coalesces requests; cache is credential-scoped and cleared on logout; fresh refreshes hit server; six reads run in parallel; targeted coupons and denied sessions remain protected.');
gate=new Promise(r=>release=r);const inFlight=cache.loadMemberCatalog('member-a');await new Promise(r=>setTimeout(r,0));cache.clearMemberCatalog();release();await inFlight;assert.equal(cache.cachedMemberCatalog('member-a'),undefined,'Logout must invalidate responses that were already in flight');
// Login lookup joins the member in one read and skips identical profile writes.
for (const status of ['active','inactive']) {
  const tables=[];let writes=0;
  const db={from(table){tables.push(table);const q={select(columns){if(table==='line_member_links')assert.match(columns,/members!inner/);return q;},eq(){return q;},update(){writes++;return q;},single(){return Promise.resolve({data:{owner_id:'owner'},error:null});},maybeSingle(){return Promise.resolve({data:table==='line_connections'?{login_channel_id:'channel'}:{member_id:'id',line_display_name:'Test',line_picture_url:null,members:{member_code:'M001',name:'Test',points:750,level:'Member',status}},error:null});}};return q;}};
  const login=load('app/api/line/member/route.ts',{'@supabase/supabase-js':{createClient:()=>db},'@/lib/line/verify-member-identity':{verifyMemberIdentity:async()=>({sub:'U'+'a'.repeat(32),name:'Test',picture:null})}},{process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.com',SUPABASE_SECRET_KEY:'server-test-key'}}});
  const response=await login.POST(new Request('http://localhost/login',{method:'POST',body:JSON.stringify({action:'lookup',accessToken:'valid'})}));
  assert.equal(response.status,status==='active'?200:403);assert.equal(writes,0);assert.ok(!tables.includes('members'),'No second member read on login');
}
let verifications=0;
const identity=load('lib/line/verify-member-identity.ts',{'server-only':{}},{URLSearchParams,fetch:async()=>{verifications++;return Response.json({aud:'channel',sub:'U'+'a'.repeat(32)});}});
await Promise.all([identity.verifyMemberIdentity({idToken:'a'.repeat(30)},'channel'),identity.verifyMemberIdentity({idToken:'a'.repeat(30)},'channel')]);assert.equal(verifications,1);
await identity.verifyMemberIdentity({idToken:'a'.repeat(30)},'channel');assert.equal(verifications,2,'Settled auth must not be reused');
assert.equal(await identity.verifyMemberIdentity({idToken:'a'.repeat(30)},'wrong'),null);
console.log('PASS: active member login uses one joined read; unchanged profiles produce no writes; inactive members remain denied; simultaneous LINE checks share work but settled authentication is fresh.');
