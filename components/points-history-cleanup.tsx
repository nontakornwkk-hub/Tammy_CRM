"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {CalendarDays,Download,FileDown,RefreshCw,Trash2,X} from "lucide-react";
import {supabase} from "@/lib/supabase/client";
import {bangkokToday} from "@/lib/points-history-range";
import {DateRangePicker} from "./date-range-picker";
import {PastelSelect} from "./pastel-select";
type Preview={from:string;to:string;snapshot:string;count:number;total:number;preserved:number;counts:{points:number;coupons:number;rewards:number;games:number;audit:number}};
async function historyRequest(path:string,init?:RequestInit){
 const token=(await supabase?.auth.getSession())?.data.session?.access_token;if(!token)throw new Error("กรุณาเข้าสู่ระบบใหม่");
 const response=await fetch(path,{...init,cache:"no-store",headers:{Authorization:`Bearer ${token}`,...init?.headers}});
 if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||"ดำเนินการไม่สำเร็จ");}return response;
}
export function PointsHistoryCleanup({onDeleted}:{onDeleted:()=>void}){
 const today=bangkokToday(),thisYear=Number(today.slice(0,4)),years=Array.from({length:thisYear-2019},(_,index)=>thisYear-index);
 const [year,setYear]=useState(thisYear),[from,setFrom]=useState(`${thisYear}-01-01`),[to,setTo]=useState(today);
 const [preview,setPreview]=useState<Preview|null>(null),[busy,setBusy]=useState<"preview"|"download"|"delete"|null>(null);
 const [confirmation,setConfirmation]=useState(""),[confirmOpen,setConfirmOpen]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const sequence=useRef(0),valid=!!from&&!!to&&from>="2020-01-01"&&from<=to&&to<=today;
 const current=preview?.from===from&&preview.to===to?preview:null;
 const loadPreview=useCallback(async()=>{
  const epoch=++sequence.current;setPreview(null);setConfirmOpen(false);setConfirmation("");setError("");
  if(!from||!to||from>to||to>bangkokToday()){setBusy(null);return;}setBusy("preview");
  try{const next=await (await historyRequest(`/api/admin/points-history?${new URLSearchParams({from,to})}`)).json() as Preview;if(epoch===sequence.current)setPreview(next);}
  catch(cause){if(epoch===sequence.current)setError(cause instanceof Error?cause.message:"นับรายการไม่สำเร็จ");}
  finally{if(epoch===sequence.current)setBusy(null);}
 },[from,to]);
 useEffect(()=>{void loadPreview();return()=>{sequence.current++;};},[loadPreview]);
 function changeYear(value:number){setYear(value);setFrom(`${value}-01-01`);setTo(value===thisYear?today:`${value}-12-31`);setMessage("");}
 async function download(){
  if(!current?.total||busy)return;setBusy("download");setError("");setMessage("");
  try{const query=new URLSearchParams({from,to,snapshot:current.snapshot,download:"1"}),blob=await (await historyRequest(`/api/admin/points-history?${query}`)).blob();
   const href=URL.createObjectURL(blob),link=document.createElement("a");link.href=href;link.download=`tammy-points-history-${from}-${to}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),60000);setMessage("ดาวน์โหลดไฟล์ CSV แล้ว ข้อมูลในระบบยังอยู่ครบ");
  }catch(cause){setError(cause instanceof Error?cause.message:"สำรองไม่สำเร็จ");}finally{setBusy(null);}
 }
 async function clear(){
  if(!current?.count||busy||confirmation!=="ล้างประวัติ")return;setBusy("delete");setError("");setMessage("");let remaining=current.count,deleted=0;
  try{while(remaining>0){const result=await (await historyRequest("/api/admin/points-history",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from,to,snapshot:current.snapshot,expectedCount:remaining,confirmation})})).json() as {deleted:number;remaining:number};
    if(!result.deleted||result.remaining>=remaining)throw new Error("ล้างรายการไม่ครบ กรุณาตรวจใหม่");deleted+=result.deleted;remaining=result.remaining;setMessage(`ล้างแล้ว ${deleted.toLocaleString("th-TH")} รายการ`);
   }setConfirmOpen(false);setConfirmation("");onDeleted();await loadPreview();
  }catch(cause){setConfirmOpen(false);setError(cause instanceof Error?cause.message:"ล้างไม่สำเร็จ");onDeleted();setPreview(null);}finally{setBusy(null);}
 }
 return <section className="points-cleanup points-cleanup-redesign" aria-labelledby="points-cleanup-title">
  <header className="history-cleanup-heading"><span><CalendarDays size={21}/></span><div><h3 id="points-cleanup-title">จัดการประวัติรายการ</h3><p>เลือกช่วงวันที่ แล้วสำรองหรือล้างข้อมูลได้ทุกเวลา</p></div></header>
  <div className="history-cleanup-period">
   <strong className="history-cleanup-period-title">เลือกช่วงวันที่</strong>
   <fieldset disabled={busy==="delete"||busy==="download"}><legend>เลือกปี</legend><PastelSelect label="ปีของประวัติ" value={String(year)} onChange={value=>changeYear(Number(value))} options={years.map(value=>({value:String(value),label:`${value+543}${value===thisYear?" · ปีนี้":""}`}))}/></fieldset>
   <fieldset className="history-cleanup-date" disabled={busy==="delete"||busy==="download"}><legend>วันที่เริ่มต้น</legend><DateRangePicker single label="เลือกวันที่เริ่มต้น" start={from} end="" min="2020-01-01" max={to||today} onChange={start=>{setFrom(start);setMessage("");}}/></fieldset>
   <fieldset className="history-cleanup-date" disabled={busy==="delete"||busy==="download"}><legend>วันที่สิ้นสุด</legend><DateRangePicker single label="เลือกวันที่สิ้นสุด" start={to} end="" min={from||"2020-01-01"} max={today} onChange={end=>{setTo(end);setMessage("");}}/></fieldset>
   <button type="button" className="history-cleanup-refresh" disabled={busy!==null||!valid} onClick={()=>void loadPreview()} aria-label="ตรวจจำนวนรายการใหม่"><RefreshCw size={17}/></button>
  </div>
  <p className="history-cleanup-count" role="status">{busy==="preview"?"กำลังตรวจจำนวนรายการ…":!valid?"กรุณาเลือกช่วงวันที่ให้ถูกต้อง":`${(current?.total||0).toLocaleString("th-TH")} รายการในช่วงที่เลือก`}</p>
  {current?.counts?<div className="history-cleanup-breakdown">{Object.entries({points:"แต้ม",coupons:"คูปอง",rewards:"แลกของรางวัล",games:"ลุ้นรางวัล",audit:"Audit log"}).map(([key,label])=><span key={key}>{label} <b>{(current.counts[key as keyof typeof current.counts]||0).toLocaleString("th-TH")}</b></span>)}</div>:null}
  <div className="history-cleanup-options">
   <article className="history-cleanup-option backup"><span className="history-cleanup-icon"><FileDown size={23}/></span><h4>สำรองข้อมูล</h4><p>ดาวน์โหลดรายการเป็น CSV<br/>เก็บข้อมูลในระบบไว้เหมือนเดิม</p><button type="button" disabled={!valid||!current?.total||busy!==null} onClick={()=>void download()}><Download size={16}/>{busy==="download"?"กำลังดาวน์โหลด…":"ดาวน์โหลด CSV"}</button></article>
   <article className="history-cleanup-option clear"><span className="history-cleanup-icon"><Trash2 size={23}/></span><h4>ล้างประวัติ</h4><p>ลบประวัติในช่วงที่เลือก<br/>ยอดแต้มและสิทธิ์เกมยังเท่าเดิม</p><button className="danger" type="button" disabled={!valid||!current?.count||busy!==null} onClick={()=>{setConfirmOpen(true);setConfirmation("");setError("");}}><Trash2 size={16}/>{busy==="delete"?"กำลังล้าง…":`ล้าง ${current?.count?.toLocaleString("th-TH")||0} รายการ`}</button></article>
  </div>
  {confirmOpen&&current?<div className="history-cleanup-confirm" role="group" aria-labelledby="history-clear-title"><div><strong id="history-clear-title">ยืนยันล้าง {current.count.toLocaleString("th-TH")} รายการ?</strong><p>ตั้งแต่ {from} ถึง {to} · ลบแล้วเรียกคืนจากระบบไม่ได้ ไม่จำเป็นต้องสำรองก่อน</p></div><label>พิมพ์ “ล้างประวัติ” เพื่อยืนยัน<input autoFocus value={confirmation} disabled={busy==="delete"} onChange={event=>setConfirmation(event.target.value)} placeholder="ล้างประวัติ"/></label><div><button className="danger" type="button" disabled={busy!==null||confirmation!=="ล้างประวัติ"} onClick={()=>void clear()}><Trash2 size={16}/>ยืนยันล้างประวัติ</button><button type="button" disabled={busy==="delete"} onClick={()=>setConfirmOpen(false)}><X size={16}/>ยกเลิก</button></div></div>:null}
  <p className="points-cleanup-note">รวมประวัติโบนัสเลื่อนระดับและวันเกิด ระบบเก็บเฉพาะสิทธิ์ที่เคยรับไว้ป้องกันโบนัสซ้ำ โดยไม่เก็บรายละเอียดรายการที่ล้าง</p>
  {message?<p className="points-cleanup-progress" role="status">{message}</p>:null}
  {error?<p className="database-usage-error" role="alert">{error}<button type="button" disabled={busy!==null} onClick={()=>void loadPreview()}>ตรวจใหม่</button></p>:null}
  <p className="points-cleanup-note">ล้างเฉพาะประวัติรายละเอียด โดยเก็บยอดสรุป กราฟรายวัน และอันดับลูกค้าไว้ดูย้อนหลัง พื้นที่ที่ลบอาจถูกฐานข้อมูลเก็บไว้ใช้ซ้ำ จึงไม่ลดทันที</p>
 </section>;
}
