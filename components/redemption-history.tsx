"use client";
import Image from "next/image";
import { Noto_Sans_Thai } from "next/font/google";
import { Gift, History, TicketPercent, UserRound, X, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
type Entry={id:string;kind:"reward"|"coupon";title:string;points:number;status:string;date:string;member:{name:string;code:string;picture:string|null}};
const reportFont=Noto_Sans_Thai({subsets:["thai","latin"],display:"swap"});
export function RedemptionHistory({onClose}:{onClose:()=>void}) {
  const [kind,setKind]=useState("all"),[page,setPage]=useState(0),[rows,setRows]=useState<Entry[]>([]),[more,setMore]=useState(false),[busy,setBusy]=useState(true),[error,setError]=useState(""),[retry,setRetry]=useState(0);
  const panel=useRef<HTMLElement>(null),list=useRef<HTMLDivElement>(null),sentinel=useRef<HTMLDivElement>(null),nextPageLock=useRef(false);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";panel.current?.querySelector<HTMLButtonElement>("[aria-label='ปิดประวัติ']")?.focus();
    const key=(event:KeyboardEvent)=>{
      if(event.key==="Escape")onClose();
      if(event.key!=="Tab")return;
      const controls=Array.from(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled),[tabindex='0']")||[]),first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    };
    document.addEventListener("keydown",key);return()=>{document.body.style.overflow=overflow;document.removeEventListener("keydown",key);previous?.focus();};
  },[onClose]);
  useEffect(()=>{
    const controller=new AbortController();setBusy(true);setError("");nextPageLock.current=true;
    void(async()=>{
      try {
        const session=await supabase?.auth.getSession(),token=session?.data.session?.access_token;
        if(!token)throw Error("กรุณาเข้าสู่ระบบใหม่");
        const response=await fetch(`/api/admin/redemptions?kind=${kind}&offset=${page*50}`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store",signal:controller.signal});
        const data=await response.json() as {rows?:Entry[];hasMore?:boolean;error?:string};
        if(!response.ok)throw Error(data.error||"โหลดประวัติไม่สำเร็จ");
        if(!controller.signal.aborted){
          setRows(current=>page===0?(data.rows||[]):[...current,...(data.rows||[]).filter(row=>!current.some(previous=>previous.id===row.id))]);
          setMore(Boolean(data.hasMore));if(page===0)list.current?.scrollTo(0,0);
        }
      }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"โหลดประวัติไม่สำเร็จ");}
      finally{if(!controller.signal.aborted){setBusy(false);nextPageLock.current=false;}}
    })();return()=>controller.abort();
  },[kind,page,retry]);
  useEffect(()=>{
    if(!more||busy||error||!sentinel.current)return;
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)&&!nextPageLock.current){nextPageLock.current=true;setPage(value=>value+1);}
    },{root:list.current,rootMargin:"0px 0px 180px 0px"});
    observer.observe(sentinel.current);return()=>observer.disconnect();
  },[more,busy,error]);
  return <div className="redemption-history-overlay" role="dialog" aria-modal="true" aria-labelledby="redemption-history-title">
    <button className="redemption-history-backdrop" type="button" aria-label="ปิดประวัติการแลก" onClick={onClose}/>
    <section ref={panel} className="redemption-history-panel" style={{fontFamily:reportFont.style.fontFamily}}>
      <header><span><History size={22}/><div><h2 id="redemption-history-title">ประวัติการใช้สิทธิ์</h2><p>การแลกของรางวัลและใช้คูปองของสมาชิก</p></div></span><button type="button" aria-label="ปิดประวัติ" onClick={onClose}><X size={20}/></button></header>
      <div className="redemption-history-filters" role="group" aria-label="ประเภทรายการ">{[{id:"all",label:"ทั้งหมด"},{id:"reward",label:"ของรางวัล"},{id:"coupon",label:"คูปอง"}].map(item=><button type="button" key={item.id} aria-pressed={kind===item.id} onClick={()=>{if(kind===item.id)return;nextPageLock.current=true;setKind(item.id);setPage(0);setRows([]);setMore(false);setBusy(true);}}>{item.label}</button>)}</div>
      <p className="redemption-history-summary">เรียงจากรายการล่าสุด <span>{rows.length.toLocaleString("th-TH")} รายการ</span></p>
      <div ref={list} className="redemption-history-list" tabIndex={0} aria-label="รายการประวัติ เลื่อนลงเพื่อดูเพิ่มเติม" aria-busy={busy}>
        {rows.map(row=><article key={row.id}>
          <span className="redemption-history-avatar">{row.member.picture?<Image src={row.member.picture} alt={`โปรไฟล์ ${row.member.name}`} width={46} height={46} unoptimized/>:<UserRound size={22}/>}</span>
          <div className="redemption-history-entry"><strong>{row.member.name}</strong><small>{row.member.code}</small><p>{row.kind==="reward"?<Gift size={14}/>:<TicketPercent size={14}/>}<span>{row.title}</span></p><time dateTime={row.date}>{new Date(row.date).toLocaleString("th-TH",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Bangkok"})}</time></div>
          <div className="redemption-history-result"><span className={`status-${row.status}`}>{row.status==="completed"?"สำเร็จ":row.status==="cancelled"?"ยกเลิก":"รอยืนยัน"}</span><small>{row.kind==="reward"?`${row.points.toLocaleString("th-TH")} แต้ม`:"ใช้ที่หน้าร้าน"}</small></div>
        </article>)}
        <div ref={sentinel} className="redemption-history-end" role="status">{busy?<span><LoaderCircle size={16}/>กำลังโหลด{rows.length?"เพิ่มเติม":"ประวัติ"}…</span>:error?<div role="alert">{error} <button className="redemption-history-retry" type="button" onClick={()=>setRetry(value=>value+1)}>ลองใหม่</button></div>:!rows.length?"ยังไม่มีประวัติในหมวดนี้":!more?"แสดงประวัติทั้งหมดแล้ว":"เลื่อนลงเพื่อดูเพิ่มเติม"}</div>
      </div>
    </section>
  </div>;
}
