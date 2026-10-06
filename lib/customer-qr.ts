import QRCode from "qrcode";
import { singleFlight } from "./single-flight";
type CouponQr={url:string;expiresAt:string};
const pending=singleFlight<CouponQr>();const coupons=new Map<string,CouponQr>();let generation=0;
const keyFor=(couponId:string,idToken?:string,accessToken?:string)=>JSON.stringify([couponId,idToken||"",accessToken||""]);
export function cachedCouponQr(couponId:string,idToken?:string,accessToken?:string){const key=keyFor(couponId,idToken,accessToken),data=coupons.get(key);if(data&&Date.parse(data.expiresAt)>Date.now()+1000)return data;coupons.delete(key);}
export function clearCouponQr(couponId?:string,idToken?:string,accessToken?:string){generation++;if(couponId)coupons.delete(keyFor(couponId,idToken,accessToken));else {coupons.clear();encoded.clear();}}
export function loadCouponQr(couponId:string,idToken?:string,accessToken?:string){
 const cached=cachedCouponQr(couponId,idToken,accessToken);if(cached)return Promise.resolve(cached);
 const key=keyFor(couponId,idToken,accessToken),epoch=generation;
 return pending(`${epoch}:${key}`,async()=>{
  const response=await fetch("/api/line/member/coupon-qr",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken,accessToken,couponId}),cache:"no-store",signal:AbortSignal.timeout(12000)});
  const data=await response.json();if(!response.ok||!data.qrPayload||!data.expiresAt)throw new Error(data.error||"เปิด QR ไม่สำเร็จ");
  const result={url:localQr(data.qrPayload),expiresAt:data.expiresAt};
  if(epoch===generation){if(coupons.size>=20)coupons.delete(coupons.keys().next().value!);coupons.set(key,result);}return result;
 });
}
// Opening coupon terms is an explicit intent to use this coupon. Prepare just
// that server-issued token, without redeeming it or changing the visible step.
export function prefetchCouponQr(couponId:string,idToken?:string,accessToken?:string){
 return loadCouponQr(couponId,idToken,accessToken).then(()=>undefined).catch(()=>undefined);
}
// Game reward QR payloads already contain a server-issued token; encoding is local.
const encoded=new Map<string,string>();
export function localQr(payload:string,width=240,margin=2){const key=JSON.stringify([payload,width,margin]);const existing=encoded.get(key);if(existing)return existing;
 const code=QRCode.create(payload,{errorCorrectionLevel:"M"}),size=code.modules.size;let path="";
 for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(code.modules.get(y,x))path+=`M${x+margin} ${y+margin}h1v1h-1z`;
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 ${size+margin*2} ${size+margin*2}" shape-rendering="crispEdges"><path fill="white" d="M0 0h${size+margin*2}v${size+margin*2}H0z"/><path fill="black" d="${path}"/></svg>`;
 const url="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);if(encoded.size>=50)encoded.delete(encoded.keys().next().value!);encoded.set(key,url);return url;
}
