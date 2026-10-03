import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function load(file,deps){const exports={};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:name=>{if(!(name in deps))throw Error(name);return deps[name];},Response,performance});return exports;}
const {prepareTestItem}=load('lib/line/test-catalog.ts',{'server-only':{}});
for(const kind of ['reward','coupon']) {
  const source={id:'11111111-1111-4111-8111-111111111111',title:'Live item',description:'Real public catalog',active:true,starts_at:null,ends_at:null,stock:7,points_cost:100,usage_limit:10,used_count:3};
  const snapshot=JSON.stringify(source);let mirrored;
  const filters=[];
  const read={select(){return this;},eq(key,value){filters.push([key,value]);return this;},async maybeSingle(){return{data:source,error:null};},upsert(){throw Error('Production must never be written');},update(){throw Error('Production must never be written');}};
  const session={catalogDb:{from:()=>read,rpc(){throw Error('Never call production redemption RPC');}},catalogOwnerId:'live-owner',db:{from:table=>({async upsert(value){assert.equal(table,kind==='reward'?'rewards':'coupons');mirrored=value;return{error:null};}})},ownerId:'test-owner'};
  assert.equal(await prepareTestItem(session,kind,source.id),null);
  assert.equal(mirrored.owner_id,'test-owner');assert.equal(mirrored.id,source.id);assert.equal(mirrored.title,source.title);
  assert.equal(JSON.stringify(source),snapshot);assert.ok(filters.some(([key,value])=>key==='owner_id'&&value==='live-owner'));
  if(kind==='reward')assert.equal(mirrored.stock,null);else{assert.equal(mirrored.usage_limit,null);assert.equal(mirrored.audience_mode,'public');assert.equal('used_count' in mirrored,false);}
  source.stock=0;source.used_count=10;
  assert.equal(await prepareTestItem(session,kind,source.id),kind==='reward'?'OUT_OF_STOCK':'LIMIT_REACHED');
  source.active=false;read.maybeSingle=async()=>({data:null,error:null});
  assert.equal(await prepareTestItem(session,kind,source.id),'ITEM_UNAVAILABLE');
}
let testRpc=0;
const route=load('app/api/line/member/redeem/route.ts',{'@/lib/line/member-session':{verifiedMemberSession:async()=>({catalogDb:{},ownerId:'test-owner',memberId:'test-member',db:{rpc:async()=>{testRpc++;return{data:[{redemption_id:'saved-in-test',remaining_points:800}],error:null};}}})},'@/lib/line/test-catalog':{prepareTestItem:async session=>{assert.equal(session.ownerId,'test-owner');return null;}}});
const response=await route.POST(new Request('http://localhost/api/line/member/redeem',{method:'POST',body:JSON.stringify({kind:'reward',itemId:'11111111-1111-4111-8111-111111111111',requestId:'22222222-2222-4222-8222-222222222222'})}));
assert.equal((await response.json()).testMode,true);assert.equal(testRpc,1);
console.log('PASS: real catalog reads are owner scoped; replicas and RPC writes use only test DB; reward stock is never deducted; sold-out and unavailable items are denied.');
