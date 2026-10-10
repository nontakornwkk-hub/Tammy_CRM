import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const stub = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
async function load(path, imports) {
  let source = await readFile(new URL('../' + path, import.meta.url), 'utf8');
  for (const [name, url] of Object.entries(imports)) source = source.replaceAll(JSON.stringify(name), JSON.stringify(url));
  let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const [name, url] of Object.entries(imports)) code = code.replaceAll(JSON.stringify(name), JSON.stringify(url));
  return import(stub(code));
}
const jsx = stub('export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment="fragment";');
const dynamic = stub('export default ()=>"dynamic";');
const gate = await load('components/admin-auth-gate.tsx', {
  'next/dynamic': dynamic, 'react/jsx-runtime': jsx,
  'next/navigation': stub('export const usePathname=()=>globalThis.__path;'),
});
for (const path of ['/customer', '/customer-preview', '/customer-preview/oauth-return', '/line-membership']) {
  globalThis.__path = path;
  assert.equal(gate.AdminAuthGate({ children: 'LINE customer' }), 'LINE customer', `${path} must bypass administrator authentication`);
}
for (const path of ['/points', '/settings', '/members', '/customer-test', '/customer-preview-admin']) {
  globalThis.__path = path;
  assert.equal(gate.AdminAuthGate({ children: 'private' }).type, 'dynamic', `${path} must retain administrator authentication`);
}
const entry = await load('components/customer-entry.tsx', {
  react: stub('export const useState=x=>{const i=globalThis.__hooks.cursor++;if(!(i in globalThis.__hooks.states))globalThis.__hooks.states[i]=x;return [globalThis.__hooks.states[i],v=>globalThis.__hooks.states[i]=v];};export const useEffect=f=>globalThis.__hooks.effects.push(f);export const useCallback=f=>f;'),
  'react/jsx-runtime': jsx, 'next/dynamic': dynamic,
  'next/navigation': stub('export const useRouter=()=>({replace:url=>globalThis.__hooks.redirects.push(url)});'),
  '@/lib/single-flight': stub('export const singleFlight=()=>async(key,fn)=>fn();'),
  '@/lib/member-bootstrap': stub('export const prepareMemberData=async()=>{};export const clearMemberDisplayData=()=>{};'),
  '@/lib/customer-portal-loader': stub('export const prepareCustomerPortal=async()=>{};export const loadCustomerPortal=async()=>({});'),
  './line-member-registration': stub('export const LineMemberRegistration="LINE";'),
  '@/lib/supabase/client': stub('export const supabase={auth:{getSession:async()=>{globalThis.__hooks.adminReads++;return {data:{session:null}};}}};'),
});
for (const hostname of ['localhost', '127.0.0.1', 'tammy-crm.vercel.app']) {
  globalThis.__hooks = { states: [], cursor: 0, effects: [], redirects: [], adminReads: 0 };
  globalThis.window = { location: { hostname, search: '' } };
  globalThis.localStorage = { getItem: () => null };
  const tree = entry.CustomerEntry({});
  assert.equal(tree.type, 'LINE');
  assert.equal(tree.props.preview, false, 'Customer entry uses real LINE rather than an administrator demo');
  for (const effect of globalThis.__hooks.effects) effect();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(globalThis.__hooks.adminReads, 0);
  assert.deepEqual(globalThis.__hooks.redirects, []);
}
console.log('PASS: LINE endpoints remain public, administrator routes stay protected, and desktop customer entry never opens administrator login');
