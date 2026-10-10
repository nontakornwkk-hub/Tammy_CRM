"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hardwareScanBuffer } from "@/lib/hardware-scan";
import { CouponQrScanner } from "./coupon-qr-scanner";
export function AdminHardwareScanner(){
 const pathname=usePathname(),router=useRouter(),[coupon,setCoupon]=useState(""),last=useRef({value:"",time:0});
 useEffect(()=>{
   const buffer=hardwareScanBuffer();
   function keydown(event:KeyboardEvent){
     const target=event.target instanceof Element?event.target:null;
     // Existing scanner inputs own their scans; ordinary form entry stays intact.
     if(target?.closest("input,textarea,select,[contenteditable='true'],[role='dialog']")){buffer.reset();return;}
     const scan=buffer.feed(event,performance.now());if(!scan)return;
     event.preventDefault();event.stopPropagation();
     if(last.current.value===scan.value&&Date.now()-last.current.time<1500)return;
     last.current={value:scan.value,time:Date.now()};
     if(scan.kind==="coupon")setCoupon(scan.value);
     else if(pathname==="/points")window.dispatchEvent(new CustomEvent("tammy-member-scan",{detail:scan.value}));
     else router.push(`/points?scan=${encodeURIComponent(scan.value)}`);
   }
   window.addEventListener("keydown",keydown,true);
   return()=>window.removeEventListener("keydown",keydown,true);
 },[pathname,router]);
 return coupon?<CouponQrScanner key={coupon} initialQr={coupon} onClose={()=>setCoupon("")}/>:null;
}
