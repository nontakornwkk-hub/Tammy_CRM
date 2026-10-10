import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const modules=new Map();
async function load(path){if(modules.has(path))return modules.get(path);let source=await readFile(new URL('../'+path,import.meta.url),'utf8');source=source.replace('import "server-only";','');let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 if(path!=='lib/single-flight.ts'){const pending=await load('lib/single-flight.ts');code=code.replaceAll('from "../single-flight"','from '+JSON.stringify(pending.url)).replaceAll('from "./single-flight"','from '+JSON.stringify(pending.url));}
 if(path==='lib/customer-qr.ts')code=code.replace('from "qrcode"','from '+JSON.stringify(new URL('../node_modules/qrcode/lib/index.js',import.meta.url).href));
 if(path==='lib/member-bootstrap.ts')for(const dependency of ['customer-catalog','customer-account-data','customer-qr']){const loaded=await load('lib/'+dependency+'.ts');code=code.replace('from "./'+dependency+'"','from '+JSON.stringify(loaded.url));}
 const url='data:text/javascript;base64,'+Buffer.from(code).toString('base64'),exports=await import(url),result={url,...exports};modules.set(path,result);return result;}
const account=await load('lib/customer-account-data.ts'),catalog=await load('lib/customer-catalog.ts'),qr=await load('lib/customer-qr.ts');
const bootstrap=await load('lib/member-bootstrap.ts');
let calls=[],expire=Date.now()+60000,fail=false,release;
globalThis.fetch=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});await new Promise(r=>setTimeout(r,30));if(release)await release.promise;
 if(fail)return Response.json({error:'failed'},{status:409});
 return Response.json(url.endsWith('/account')?{profile:{points:100},pointsHistory:[],hasMore:false}:url.endsWith('/catalog')?{rewards:[{id:'reward'}],points:100}:{qrPayload:'TAMMY-COUPON:server-issued-token',expiresAt:new Date(expire).toISOString()});};
let releaseStartup;release={promise:new Promise(resolve=>releaseStartup=resolve)};let ready=false;
const startup=bootstrap.prepareMemberData('A').then(()=>{ready=true;});
const concurrent=Promise.all([account.loadMemberAccount('A'),catalog.loadMemberCatalog('A')]);
await new Promise(resolve=>setTimeout(resolve,40));assert.equal(ready,false,'Entry remains loading until the initial data requests finish');assert.equal(calls.length,2,'Entry and mount share each pending read');
releaseStartup();await Promise.all([startup,concurrent]);release=null;assert.ok(account.cachedMemberAccount('A'));assert.ok(catalog.cachedMemberCatalog('A'));
const warmStart=performance.now();await Promise.all([account.loadMemberAccount('A'),catalog.loadMemberCatalog('A')]);const warm=performance.now()-warmStart;assert.equal(calls.length,2);assert.ok(warm<100);
assert.equal(account.cachedMemberAccount('B'),undefined);assert.equal(catalog.cachedMemberCatalog('B'),undefined);
await account.loadMemberAccount('A',undefined,{fresh:true});assert.equal(calls.length,3);
const [one,two]=await Promise.all([qr.loadCouponQr('coupon','A'),qr.loadCouponQr('coupon','A')]);assert.equal(one.url,two.url);assert.equal(calls.length,4);assert.ok(one.url.startsWith('data:image/svg+xml'));
await qr.loadCouponQr('coupon','A');assert.equal(calls.length,4,'Opening a valid QR again sends no issue request');
qr.clearCouponQr('coupon','A');assert.equal(qr.cachedCouponQr('coupon','A'),undefined);expire=Date.now()-1;await qr.loadCouponQr('coupon','A');assert.equal(qr.cachedCouponQr('coupon','A'),undefined,'Expired QR is never reused');
fail=true;await assert.rejects(qr.loadCouponQr('failure','A'),/failed/);assert.equal(qr.cachedCouponQr('failure','A'),undefined);fail=false;
let resolve;release={promise:new Promise(r=>resolve=r)};const inflight=account.loadMemberAccount('A',undefined,{fresh:true});await new Promise(r=>setTimeout(r,40));account.clearMemberAccount();resolve();await inflight;release=null;assert.equal(account.cachedMemberAccount('A'),undefined,'Logout prevents a late response repopulating display cache');
account.clearMemberAccount();catalog.clearMemberCatalog();qr.clearCouponQr();assert.equal(account.cachedMemberAccount('A'),undefined);assert.equal(catalog.cachedMemberCatalog('A'),undefined);
fail=true;await assert.rejects(bootstrap.prepareMemberData('failed-entry'),/failed/);await new Promise(resolve=>setTimeout(resolve,40));assert.equal(catalog.cachedMemberCatalog('failed-entry'),undefined,'Failed preload never opens an empty ready catalog');fail=false;
const started=performance.now(),svg=qr.localQr('TAMMY-COUPON:server-issued-token',280),encodedMs=performance.now()-started;assert.equal(qr.localQr('TAMMY-COUPON:server-issued-token',280),svg);assert.ok(svg.startsWith('data:image/svg+xml'));assert.ok(encodedMs<100);
const QRCode=(await import('qrcode')).default,code=QRCode.create('TAMMY-COUPON:server-issued-token',{errorCorrectionLevel:'M'}),svgXml=decodeURIComponent(svg.split(',').slice(1).join(','));const cells=[...svgXml.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map(m=>[Number(m[1])-2,Number(m[2])-2]);assert.equal(cells.length,[...code.modules.data].filter(Boolean).length);for(const [x,y]of cells)assert.ok(code.modules.get(y,x),'SVG preserves the encoded QR matrix');
const context=await load('lib/line/shop-context.ts');let configReads=0,channel='channel-1';
const fakeDb={from(table){const builder={select(){return builder;},eq(){return builder;},single(){return builder;},maybeSingle(){return builder;},async then(resolve){configReads++;await new Promise(r=>setTimeout(r,15));resolve({error:null,data:table==='public_shop_profiles'?{owner_id:'shop'}:{login_channel_id:channel,liff_id:'liff'}});}};return builder;}};
const contexts=await Promise.all([context.memberShopContext(fakeDb),context.memberShopContext(fakeDb),context.memberShopContext(fakeDb)]);assert.equal(configReads,2,'Concurrent login/bootstrap share shop and connection reads');assert.ok(contexts.every(c=>c.ownerId==='shop'&&c.channelId==='channel-1'));
channel='channel-2';assert.equal((await context.memberShopContext(fakeDb)).channelId,'channel-2');assert.equal(configReads,4,'Settled channel configuration is never reused');
console.log('PASS: request deduplication, isolated display cache, fresh reads, QR reuse/expiry/failure, logout race, QR matrix, concurrent login configuration reads. Warm data '+warm.toFixed(2)+' ms; local QR '+encodedMs.toFixed(2)+' ms (local test).');
