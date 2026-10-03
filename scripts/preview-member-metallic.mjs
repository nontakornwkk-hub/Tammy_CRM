import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
import * as icons from 'lucide-react';
import {renderToStaticMarkup} from 'react-dom/server';
import QRCode from 'qrcode';
const directory=process.argv[2];if(!directory)throw Error('Supply output directory');mkdirSync(directory,{recursive:true});
let flipped=false;const exports={};
runInNewContext(ts.transpileModule(readFileSync('components/customer-member-card.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>name==='react'?{useState:()=>[flipped,()=>{}]}:name==='lucide-react'?icons:name==='next/image'?{default:({unoptimized,...props})=>jsx.jsx('img',props)}:jsx});
let styles=[...readFileSync('app/layout.tsx','utf8').matchAll(/import "\.\/(.+\.css)"/g)].map(match=>readFileSync('app/'+match[1],'utf8')).join('\n');
for(const rank of ['gold','silver','platinum'])styles=styles.replaceAll(`/assets/membership-${rank}-cat.webp`,'data:image/webp;base64,'+readFileSync(`public/assets/membership-${rank}-cat.webp`).toString('base64'));
const qr=await QRCode.toDataURL('TAMMY-PREVIEW-NOT-REDEEMABLE',{width:220,margin:1});
const props=[{level:'Member',points:750,progress:{percent:0,remaining:5000,next:'Gold'}},{level:'Silver',points:1250,progress:{percent:62.5,remaining:750,next:'Gold'}},{level:'Gold',points:3500,progress:{percent:70,remaining:1500,next:'Platinum'}},{level:'Platinum',points:8200,progress:{percent:100,remaining:0,next:null}}];
let html='';for(const back of [false,true]){flipped=back;for(const item of props)html+=renderToStaticMarkup(exports.CustomerMemberCard({...item,name:'สมาชิกตัวอย่าง',memberCode:'PREVIEW',qr,preview:true}));}
writeFileSync(directory+'/membership.html',`<!doctype html><meta charset="utf-8"><style>${styles}\nhtml,body{margin:0;padding:15px;background:#f8f8f7;font-family:Arial,sans-serif}main{display:grid;gap:12px;width:350px;margin:auto}.customer-card-flip{margin:0}.customer-card-flip-hint{display:none!important}*,*:before,*:after{box-sizing:border-box}</style><main class="customer-catalog-refresh">${html}</main>`);
console.log('Created front/back previews from production membership component and styles.');
