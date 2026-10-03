import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import * as icons from 'lucide-react';
const state=[],refs=[],effects=[];let stateIndex=0,refIndex=0,observer;
const react={useState:initial=>{const i=stateIndex++;if(!(i in state))state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useRef:initial=>{const i=refIndex++;return refs[i]??(refs[i]={current:initial});},useEffect:effect=>effects.push(effect)};
const calls=[],row=i=>({id:String(i),kind:'reward',title:'Reward',points:1,status:'completed',date:'2026-10-03T00:00:00Z',member:{name:'Member',code:'M001',picture:null}});
const exports={};
const font={Noto_Sans_Thai:()=>({style:{fontFamily:'sans-serif'}})};
runInNewContext(ts.transpileModule(readFileSync('components/redemption-history.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>name==='next/font/google'?font:name==='react'?react:name==='lucide-react'?icons:name==='next/image'?{default:()=>null}:name==='@/lib/supabase/client'?{supabase:{auth:{getSession:async()=>({data:{session:{access_token:'test'}}})}}}:jsx,AbortController,IntersectionObserver:class{constructor(callback){observer=callback;}observe(){}disconnect(){}},fetch:async url=>{calls.push(url);return Response.json({rows:url.includes('offset=50')?[row(50)]:Array.from({length:50},(_,i)=>row(i)),hasMore:!url.includes('offset=50')});}});
function render(){stateIndex=0;refIndex=0;effects.length=0;return exports.RedemptionHistory({onClose:()=>{}});}
const settle=async()=>{for(let i=0;i<100&&state[4];i++)await new Promise(resolve=>setTimeout(resolve,5));assert.equal(state[4],false);};
render();refs[1].current={scrollTo(){}};refs[2].current={};effects[1]();await settle();assert.equal(state[2].length,50);
render();effects[2]();observer([{isIntersecting:true}]);observer([{isIntersecting:true}]);assert.equal(state[1],1,'Repeated observer callbacks must request only one next page');
render();effects[1]();await settle();assert.equal(state[2].length,51,'Scrolling must append, not replace records');assert.equal(state[3],false);assert.equal(calls.length,2);
function nodes(element){if(!element||typeof element!=='object')return[];return[element,...[element.props?.children].flat(Infinity).flatMap(nodes)];}
const elements=nodes(render());assert.equal(elements.some(node=>node.type==='footer'),false,'No page navigation footer');
elements.find(node=>node.type==='button'&&node.props.children==='คูปอง').props.onClick();assert.equal(state[0],'coupon');assert.equal(state[1],0);assert.equal(state[2].length,0);
console.log('PASS: scrolling appends history; duplicate observer events are locked; filters reset safely; no page navigation buttons.');
