import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import * as icons from 'lucide-react';
import {renderToStaticMarkup} from 'react-dom/server';
function load(file,deps){const exports={};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{if(!(name in deps))throw Error(name);return deps[name];},Response,URL});return exports;}
const {CouponTicketFace,couponThemes,couponTheme}=load('components/coupon-ticket-face.tsx',{'react/jsx-runtime':jsx,'lucide-react':icons});
assert.equal(couponThemes.length,5);assert.equal(couponTheme('unknown'),'coral');
const props={title:'ลดทุกสินค้า',discountType:'percent',discountValue:15,minSpend:0,remaining:2,endsAt:null,theme:'mint'};
assert.equal(renderToStaticMarkup(jsx.jsx(CouponTicketFace,{...props,variant:'default'})),renderToStaticMarkup(jsx.jsx(CouponTicketFace,{...props,variant:'member'})),'Both surfaces must render the same coupon');
assert.match(renderToStaticMarkup(jsx.jsx(CouponTicketFace,{...props,remaining:0,onUse:()=>{}})),/disabled/);
const source='app/api/admin/redemptions/route.ts';
for(const actor of [null,{role:'staff',ownerId:'owner'}]){
  const route=load(source,{'@/lib/line/server':{crmActor:async()=>actor,noStore:(data,status=200)=>Response.json(data,{status}),serviceDb:()=>{throw Error('Denied callers must not access DB');}}});
  assert.equal((await route.GET(new Request('http://localhost/api/admin/redemptions'))).status,403);
}
for(const kind of ['all','reward','coupon']){
  const filters=[],tables=[];
  const rows=Array.from({length:51},(_,i)=>({id:String(i),member_id:'member',reward_id:kind==='coupon'?null:'reward',coupon_id:kind==='coupon'?'coupon':null,status:'completed',points_spent:100,redeemed_at:'2026-10-03T00:00:00Z',members:{name:'Member',member_code:'M001'},rewards:{title:'Reward'},coupons:{title:'Coupon'}}));
  function query(table){return{select(){return this;},eq(key,value){filters.push([table,key,value]);return this;},not(key,op,value){filters.push([table,key,op,value]);return this;},in(key,ids){assert.deepEqual(Array.from(ids),['member']);return this;},order(){return this;},range(a,b){assert.equal(a,0);assert.equal(b,50);return Promise.resolve({data:rows,error:null});},then(resolve){return Promise.resolve({data:[{member_id:'member',line_picture_url:'https://example.com/profile.png'}],error:null}).then(resolve);}};}
  const route=load(source,{'@/lib/line/server':{crmActor:async()=>({role:'owner',ownerId:'owner'}),noStore:(data,status=200)=>Response.json(data,{status}),safeLineUrl:value=>value?.startsWith('https:')?value:null,serviceDb:()=>({from(table){tables.push(table);return query(table);}})}});
  const response=await route.GET(new Request('http://localhost/api/admin/redemptions?kind='+kind));const data=await response.json();
  assert.equal(data.rows.length,50);assert.equal(data.hasMore,true);assert.equal(data.rows[0].member.picture,'https://example.com/profile.png');
  for(const table of tables)assert.ok(filters.some(filter=>filter[0]===table&&filter[1]==='owner_id'&&filter[2]==='owner'),'Every table query must be owner scoped');
  assert.ok(filters.some(filter=>filter[1]==='members.owner_id'));
  if(kind!=='all')assert.ok(filters.some(filter=>filter[1]===kind+'_id'&&filter[2]==='is'));
  assert.equal((await route.GET(new Request('http://localhost/api/admin/redemptions?offset=-1'))).status,400);
}
if(process.argv[2]){
  const directory=process.argv[2];mkdirSync(directory,{recursive:true});
  const styles=[...readFileSync('app/layout.tsx','utf8').matchAll(/import "\.\/(.+\.css)"/g)].map(match=>readFileSync('app/'+match[1],'utf8')).join('\n');
  const cards=couponThemes.map(theme=>renderToStaticMarkup(jsx.jsx(CouponTicketFace,{...props,theme:theme.id,title:theme.id==='mint'?'เมื่อซื้อครบ 500 บาท':'ลดทุกสินค้า',discountType:theme.id==='mint'?'fixed':'percent',discountValue:theme.id==='mint'?100:15,minSpend:theme.id==='mint'?500:0,onUse:()=>{}}))).join('');
  writeFileSync(directory+'/coupons.html',`<!doctype html><meta charset="utf-8"><style>${styles}\nbody{margin:0;padding:22px;background:#fffcf8;font-family:Arial,sans-serif}main{width:350px;max-width:100%;margin:auto;display:grid;gap:14px}*,*:before,*:after{box-sizing:border-box}</style><main>${cards}</main>`);
}
console.log('PASS: shared coupon rendering, five colors, exhausted state, history authorization, owner scoping, profiles, filters and pagination.');
