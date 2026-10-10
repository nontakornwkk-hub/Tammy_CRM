import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const compile=async path=>ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const memberUrl=url(await compile('lib/member-code.ts'));
const {hardwareScanBuffer,parseHardwareScan}=await import(url((await compile('lib/hardware-scan.ts')).replace('from "./member-code"','from '+JSON.stringify(memberUrl))));
const token='12345678-1234-1234-1234-123456789abc',payload='TAMMY-COUPON:'+token;
function scan(text,{delay=8,suffix='Enter',thai=false}={}){const buffer=hardwareScanBuffer();let time=1000;for(const char of text){const upper=char.toUpperCase(),code=/[A-Z]/.test(upper)?'Key'+upper:/[0-9]/.test(char)?'Digit'+char:char==='-'?'Minus':char===':'?'Semicolon':'';assert.equal(buffer.feed({key:thai&&/[A-Z]/.test(upper)?'ก':char,code,shiftKey:char===':'},time+=delay),null);}return buffer.feed({key:suffix,code:suffix},time+delay);}
assert.deepEqual(scan('TAMMY-MEMBER:TM000123'),{kind:'member',value:'TM000123'});
assert.deepEqual(scan('TM000124',{suffix:'Tab'}),{kind:'member',value:'TM000124'});
assert.deepEqual(scan(payload,{thai:true}),{kind:'coupon',value:payload.toUpperCase()});
assert.deepEqual(scan('TAMMY-TEST-COUPON:'+token),{kind:'coupon',value:'TAMMY-TEST-COUPON:'+token.toUpperCase()});
assert.equal(scan('TAMMY-MEMBER:TM000123',{delay:250}),null,'Normal typing must not route');
assert.equal(scan('unrelated-product-123'),null);
assert.equal(parseHardwareScan('https://example.com/qr'),null);
const buffer=hardwareScanBuffer();buffer.feed({key:'T',code:'KeyT'},1000);buffer.feed({key:'Escape',code:'Escape'},1008);assert.equal(buffer.feed({key:'Enter',code:'Enter'},1016),null);
console.log('PASS: member/coupon routing, Enter/Tab terminators, Thai keyboard layout, test coupon isolation, slow typing, unknown payloads and buffer reset.');
