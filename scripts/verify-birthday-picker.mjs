import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import * as icons from 'lucide-react';
const state=[true,'day',{year:2024,month:1,day:31},2020];
let index=0,saved;
const exports={};
const react={useId:()=> 'date-test',useRef:()=>({current:null}),useEffect:()=>{},useState:()=>{const i=index++;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];}};
runInNewContext(ts.transpileModule(readFileSync('components/customer-date-calendar.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>name==='react'?react:name==='lucide-react'?icons:jsx});
function render(){index=0;return exports.CustomerBirthdayPicker({value:'2024-01-31',onChange:value=>{saved=value;}});}
function nodes(element){if(!element||typeof element!=='object')return[];return[element,...[element.props?.children].flat(Infinity).flatMap(nodes)];}
function clickText(text){const button=nodes(render()).find(node=>node.type==='button'&&node.props.children===text);assert.ok(button,text);button.props.onClick();}
clickText('มกราคม');assert.equal(state[1],'month');clickText('กุมภาพันธ์');assert.equal(state[2].day,29,'Leap February clamps January 31 to February 29');
clickText(2567);assert.equal(state[1],'year');clickText(2566);assert.equal(state[2].day,28,'Changing to non-leap year clamps February 29');
clickText('ยืนยัน');assert.equal(saved,'2023-02-28');assert.equal(state[0],false);
state[0]=true;state[2]={year:new Date().getFullYear()+1,month:1,day:1};
assert.equal(nodes(render()).find(node=>node.type==='button'&&node.props.children==='ยืนยัน').props.disabled,true);
console.log('PASS: compact calendar month/year switching, leap dates, ISO confirmation, and future-date prevention.');
