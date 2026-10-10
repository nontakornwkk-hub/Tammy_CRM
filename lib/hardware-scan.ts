import { memberScannerKey, normalizeCouponScan, normalizeMemberScan } from "./member-code";
export type HardwareScan={kind:"member"|"coupon";value:string};
export function parseHardwareScan(raw:string):HardwareScan|null {
 const coupon=normalizeCouponScan(raw);
 if(coupon)return{kind:"coupon",value:coupon};
 const code=normalizeMemberScan(raw);
 return /^TM[A-Z0-9]{4,36}$/.test(code)?{kind:"member",value:code}:null;
}
// A keyboard-wedge reader emits a rapid burst ending in Enter or Tab.
export function hardwareScanBuffer(){
 let text="",last=0,count=0;
 return {reset(){text="";last=0;count=0;},feed(event:{key:string;code:string;shiftKey?:boolean;ctrlKey?:boolean;altKey?:boolean;metaKey?:boolean;repeat?:boolean},now:number):HardwareScan|null{
   if(event.ctrlKey||event.altKey||event.metaKey||event.repeat){this.reset();return null;}
   if(event.key==="Enter"||event.key==="Tab"){const result=count>=6&&now-last<=150?parseHardwareScan(text):null;this.reset();return result;}
   if(event.key==="Shift")return null;
   if(event.key.length!==1){this.reset();return null;}
   if(now-last>100)this.reset();
   const char=memberScannerKey(event.code)||(event.code==="Minus"?"-":event.code==="Semicolon"&&event.shiftKey?":":event.key);
   text+=char;last=now;count++;if(text.length>160)this.reset();return null;
 }};
}
