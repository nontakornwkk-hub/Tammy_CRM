import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const stub=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
async function load(path,imports={},suffix='') {
  let source=await readFile(new URL('../'+path,import.meta.url),'utf8');
  for(const [name,url] of Object.entries(imports)) source=source.replaceAll(`"${name}"`,JSON.stringify(url));
  let code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  for(const [name,url] of Object.entries(imports))code=code.replaceAll(`"${name}"`,JSON.stringify(url));
  const url=stub(code+'\n//'+suffix);return {url,...await import(url)};
}
const flight=await load('lib/single-flight.ts'),flow=await load('lib/line/login-flow.ts'),phone=await load('lib/line/phone-confirmation.ts');
const phoneInput=await load('lib/line/phone-input.ts');
for (const value of ['099-000-0000','099 000 0000','(099) 000-0000','+66 99-000-0000','0066 99 000 0000']) assert.equal(phoneInput.normalizeThaiPhone(value),'0990000000');
assert.equal(phoneInput.normalizeThaiPhone('099000000011'),'099000000011','Invalid long input is not silently truncated to another number');
assert.equal(phone.pendingPhone(phone.phoneContinuation('0990000000',1000),1001),'0990000000');
for(const value of [null,'{}','bad',phone.phoneContinuation('088',1000),phone.phoneContinuation('0990000000',1000)])
  assert.equal(phone.pendingPhone(value,301000),undefined,'Malformed and expired form continuation cannot resume login');
assert.equal(phone.pendingPhone(phone.phoneContinuation('0990000000',1001),1000),undefined);

// Render the real component and drive its event/effect handlers with controlled LINE and network.
// This exercises transitions without pretending to authenticate through an actual LINE account.
class Hooks {
  values=[];effects=[];queued=[];cursor=0;effectCursor=0;
  useState(initial) {const i=this.cursor++;if(!(i in this.values))this.values[i]=typeof initial==='function'?initial():initial;return [this.values[i],value=>this.values[i]=typeof value==='function'?value(this.values[i]):value];}
  useEffect(fn,deps) {const i=this.effectCursor++,old=this.effects[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))this.queued.push(()=>{old?.cleanup?.();this.effects[i]={fn,deps,cleanup:fn()};});}
  render(component,props={preview:false}) {this.cursor=0;this.effectCursor=0;globalThis.__loginHooks=this;return component(props);}
  flush() {for(const run of this.queued.splice(0))run();}
  cleanup() {for(const item of this.effects)item.cleanup?.();}
}
const react=stub('export const useState=x=>globalThis.__loginHooks.useState(x);export const useEffect=(f,d)=>globalThis.__loginHooks.useEffect(f,d);');
const jsx=stub('export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment="fragment";');
const imports={react,'react/jsx-runtime':jsx,'lucide-react':stub('export const ArrowRight="arrow",PawPrint="paw",UserPlus="user",Dog="dog",Cat="cat",ChevronLeft="back";'),
  'next/dynamic':stub('export default ()=>"CustomerPortal";'),'next/image':stub('export default "img";'),
  '@/lib/customer-portal-loader':stub('export const prepareCustomerPortal=()=>globalThis.__loginPortal();export const loadCustomerPortal=()=>Promise.resolve({CustomerPortal:"CustomerPortal"});'),
  '@/lib/member-bootstrap':stub('export const prepareMemberData=async()=>{globalThis.__loginCounts.extraReads++;};export const seedMemberData=data=>globalThis.__loginCounts.seeds.push(data);export const clearMemberDisplayData=()=>globalThis.__loginCounts.clears++;'),
  '@/lib/line/login-flow':flow.url,'@/lib/line/phone-confirmation':phone.url,'@/lib/line/phone-input':phoneInput.url,'@/lib/single-flight':flight.url,
  './customer-birthday-picker':stub('export const CustomerBirthdayPicker="birthday";'),'./profile-photo':stub('export const ProfilePhoto="photo";'),
  '@line/liff':stub('export default globalThis.__loginLiff;')};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};};
const nodes=(tree)=>!tree||typeof tree!=='object'?[]:[tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];
const find=(tree,predicate)=>nodes(tree).find(predicate);
const screen=tree=>tree.props?.className?.match(/line-entry--(\w+)/)?.[1]||tree.type;
const tick=()=>new Promise(r=>setTimeout(r,5));
async function until(predicate) {for(let n=0;n<400;n++){if(predicate())return;await tick();}throw new Error('Timed out waiting for controlled login');}
let moduleId=0,calls=[],logged=true,memberRelease,wrongPhone=false;
function setup() {
  globalThis.localStorage=storage();globalThis.sessionStorage=storage();
  globalThis.window={location:{search:'',hash:'',href:'https://shop.example/customer-preview'}};
  globalThis.__loginCounts={init:0,oauth:0,logout:0,seeds:[],extraReads:0,clears:0};
  globalThis.__loginPortal=async()=>{};
  globalThis.__loginLiff={isInClient:()=>true,isLoggedIn:()=>logged,init:async()=>{globalThis.__loginCounts.init++;},login:()=>{globalThis.__loginCounts.oauth++;},logout:()=>{globalThis.__loginCounts.logout++;},getIDToken:()=> 'verified-by-server',getAccessToken:()=> 'access'};
  calls=[];logged=true;memberRelease=null;wrongPhone=false;
  globalThis.fetch=async(url,options={})=>{
    calls.push({url,body:options.body?JSON.parse(options.body):null});
    if(url.endsWith('/config'))return Response.json({liffId:'test-liff'});
    if(memberRelease)await memberRelease;
    if(wrongPhone)return Response.json({error:'เบอร์โทรไม่ตรง'},{status:403});
    return Response.json({registered:true,member:{memberCode:'TM-TEST',name:'Member',level:'Gold',points:120},bootstrap:{catalog:{rewards:[{id:'reward'}]},account:{profile:{points:120},pointsHistory:[],hasMore:false}}});
  };
}
async function component() {return (await load('components/line-member-registration.tsx',imports,String(moduleId++))).LineMemberRegistration;}
const submitPhone=async(h,Component,value)=>{
  let tree=h.render(Component);find(tree,n=>n.type==='input').props.onChange({target:{value}});
  tree=h.render(Component);await find(tree,n=>n.type==='form').props.onSubmit({preventDefault(){}});
  assert.equal(screen(h.render(Component)),'loading','Phone submit shows the central loader synchronously');h.flush();
};
const realFetch=globalThis.fetch;
try {
  setup();localStorage.setItem('tammy-customer-signed-out','1');
  let Component=await component(),h=new Hooks();
  assert.equal(screen(h.render(Component)),'phone','A signed-out customer sees the phone form on the first component render');h.flush();await tick();assert.equal(calls.length,0,'Signed-out entry performs no config, LINE or member work');
  let release;memberRelease=new Promise(r=>release=r);
  assert.equal(find(h.render(Component),n=>n.type==='input').props.maxLength,undefined,'Autofill formatting must not consume a ten-character limit');
  await submitPhone(h,Component,'099-000-0000');await until(()=>calls.some(c=>c.body?.action==='confirmPhone'));
  assert.equal(calls.find(c=>c.body?.action==='confirmPhone').body.phone,'0990000000');
  assert.equal(calls.filter(c=>c.body?.action==='lookup').length,0,'Phone continuation skips preliminary member lookup');
  assert.equal(screen(h.render(Component)),'loading');assert.equal(__loginCounts.seeds.length,0);
  release();await until(()=>__loginCounts.seeds.length===1);
  let tree=h.render(Component);assert.equal(screen(tree),'CustomerPortal');assert.equal(__loginCounts.extraReads,0,'Bundled data prevents catalog/account API calls');
  const beforeLogout=calls.length;tree.props.onLogout();
  assert.equal(screen(h.render(Component)),'phone','Logout shows the phone form synchronously');h.flush();await tick();
  assert.equal(calls.length,beforeLogout,'Logout does not wait for or start another login request');assert.equal(__loginCounts.logout,0);assert.equal(__loginCounts.clears,1);
  wrongPhone=true;await submitPhone(h,Component,'0880000000');await until(()=>screen(h.render(Component))==='phone');
  assert.ok(find(h.render(Component),n=>n.props?.role==='alert'));assert.equal(localStorage.getItem('tammy-customer-signed-out'),'1');
  wrongPhone=false;await submitPhone(h,Component,'0990000000');await until(()=>screen(h.render(Component))==='CustomerPortal');
  assert.equal(__loginCounts.init,1,'Login after portal logout reuses the initialized LINE transport');
  assert.equal(sessionStorage.getItem(phone.pendingPhoneKey),null);assert.equal(localStorage.getItem('tammy-customer-signed-out'),null);h.cleanup();

  setup();localStorage.setItem('tammy-customer-signed-out','1');logged=false;Component=await component();h=new Hooks();h.render(Component);h.flush();
  await submitPhone(h,Component,'0990000000');await until(()=>__loginCounts.oauth===1);assert.equal(calls.filter(c=>c.body).length,0);
  h.cleanup();logged=true;window.location.search='?code=callback&state=callback';
  Component=await component();h=new Hooks();assert.equal(screen(h.render(Component)),'loading','OAuth callback continues the already submitted phone without another form');h.flush();
  await until(()=>screen(h.render(Component))==='CustomerPortal');
  assert.equal(__loginCounts.oauth,1,'Returning from LINE never starts a second OAuth login');assert.equal(calls.filter(c=>c.body).length,1);assert.equal(calls.find(c=>c.body).body.phone,'0990000000');h.cleanup();

  setup();localStorage.setItem('tammy-line-returning','1');Component=await component();h=new Hooks();assert.equal(screen(h.render(Component)),'loading','Automatic entry starts with one stable loading screen');h.flush();await until(()=>screen(h.render(Component))==='CustomerPortal');
  assert.equal(calls.filter(c=>c.body).length,1);assert.equal(calls.find(c=>c.body).body.action,'lookup');assert.equal(__loginCounts.extraReads,0);h.cleanup();

  setup();localStorage.setItem('tammy-line-returning','1');Component=await component();h=new Hooks();h.render(Component);h.flush();
  h.effects[0].cleanup?.();h.effects[0].cleanup=h.effects[0].fn();
  await until(()=>screen(h.render(Component))==='CustomerPortal');
  assert.equal(__loginCounts.init,1,'React effect replay shares one pending LIFF initialization');
  assert.equal(calls.filter(c=>c.url.endsWith('/config')).length,1);assert.equal(calls.filter(c=>c.body).length,1,'Effect replay never repeats the member lookup');h.cleanup();

  setup();localStorage.setItem('tammy-line-returning','1');let lateRelease;memberRelease=new Promise(r=>lateRelease=r);Component=await component();h=new Hooks();h.render(Component);h.flush();await until(()=>calls.some(c=>c.body));h.cleanup();lateRelease();await tick();await tick();assert.equal(__loginCounts.seeds.length,0,'An abandoned login cannot seed member data or reopen the portal');
  for (const search of ['', '?liff.state=%2Fcustomer']) {
    setup();logged=false;window.location.search=search;Component=await component();h=new Hooks();
    assert.equal(screen(h.render(Component)),'entry','First-time entry shows LINE login and signup immediately');h.flush();
    await until(()=>calls.some(c=>c.url.endsWith('/config')));await tick();await tick();
    assert.equal(screen(h.render(Component)),'entry');assert.equal(__loginCounts.oauth,0,'Opening LINE does not force OAuth before pressing a button');assert.equal(calls.filter(c=>c.body).length,0);
    find(h.render(Component),n=>n.props?.className==='line-entry-signup-link').props.onClick();h.render(Component);h.flush();await until(()=>__loginCounts.oauth===1);h.cleanup();
  }
  setup();Component=await component();h=new Hooks();let signup=h.render(Component,{preview:true,previewScreen:'register'});
  const signupPhone=find(signup,n=>n.type==='input'&&n.props.type==='tel');assert.equal(signupPhone.props.maxLength,undefined);
  signupPhone.props.onChange({target:{value:'+66 99-000-0000'}});signup=h.render(Component,{preview:true,previewScreen:'register'});
  assert.equal(find(signup,n=>n.type==='input'&&n.props.type==='tel').props.value,'0990000000');h.cleanup();
  const config=await load('next.config.ts');assert.equal(config.default.redirects,undefined);assert.deepEqual(config.default.rewrites(),[{source:'/customer-preview/:path*',destination:'/customer'}],'The registered endpoint is served without an OAuth-breaking redirect');
  console.log('PASS: immediate logout/phone entry, synchronous loading after submit, wrong-phone retry, one OAuth continuation, one bundled auto-login request, cancelled login isolation and preserved LIFF endpoint.');
} finally {globalThis.fetch=realFetch;}
