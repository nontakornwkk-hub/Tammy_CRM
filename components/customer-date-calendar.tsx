"use client";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
const months = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
type DateParts = { year:number; month:number; day:number };
const iso = (date:DateParts) => `${date.year}-${String(date.month).padStart(2,"0")}-${String(date.day).padStart(2,"0")}`;
const countDays = (year:number,month:number) => new Date(year,month,0).getDate();
const fullDate = (date:DateParts) => `${date.day} ${months[date.month-1]} ${date.year+543}`;
function parse(value:string):DateParts|null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year,month,day]=value.split("-").map(Number);
  return year>=1900&&month>=1&&month<=12&&day>=1&&day<=countDays(year,month)?{year,month,day}:null;
}
export function CustomerBirthdayPicker({value,onChange,disabled=false,required=false}:{value:string;onChange:(date:string)=>void;disabled?:boolean;required?:boolean}) {
  const id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null);
  const [open,setOpen]=useState(false),[view,setView]=useState<"day"|"month"|"year">("day");
  const [draft,setDraft]=useState<DateParts>({year:2000,month:1,day:1}),[yearPage,setYearPage]=useState(2000);
  const today=new Date(),currentYear=today.getFullYear();
  const todayIso=iso({year:currentYear,month:today.getMonth()+1,day:today.getDate()});
  const selected=parse(value),valid=iso(draft)<=todayIso;
  useEffect(()=>{
    if(!open)return;
    const previous=document.body.style.overflow;document.body.style.overflow="hidden";
    const frame=requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>("[aria-label='ปิด']")?.focus());
    function keyboard(event:KeyboardEvent){
      if(event.key==="Escape")setOpen(false);
      if(event.key!=="Tab")return;
      const controls=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")||[]);
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    document.addEventListener("keydown",keyboard);
    return()=>{cancelAnimationFrame(frame);document.body.style.overflow=previous;document.removeEventListener("keydown",keyboard);trigger.current?.focus({preventScroll:true});};
  },[open]);
  function choose(part:"year"|"month",next:number){setDraft(date=>{const updated={...date,[part]:next};return{...updated,day:Math.min(date.day,countDays(updated.year,updated.month))};});setView("day");}
  function move(amount:number){
    if(view==="year"){setYearPage(year=>year+amount*12);return;}
    setDraft(date=>{const next=new Date(date.year,date.month-1+amount,1);return{year:next.getFullYear(),month:next.getMonth()+1,day:Math.min(date.day,countDays(next.getFullYear(),next.getMonth()+1))};});
  }
  const firstDay=new Date(draft.year,draft.month-1,1).getDay();
  return <div className="customer-birth-picker">
    <span className="customer-birth-label" id={`${id}-label`}><CalendarDays size={15}/>วันเกิด{required&&<span>*</span>}</span>
    <button ref={trigger} type="button" disabled={disabled} className="customer-birth-trigger" aria-labelledby={`${id}-label ${id}-value`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>{const next=selected||{year:currentYear-25,month:1,day:1};setDraft(next);setYearPage(next.year-5);setView("day");setOpen(true);}}><span className="customer-birth-trigger-icon"><CalendarDays size={20}/></span><span id={`${id}-value`}><strong>{selected?fullDate(selected):"เลือกวันเกิดของคุณ"}</strong><small>วัน / เดือน / ปี พ.ศ.</small></span><ChevronRight size={17}/></button>
    {open&&<div className="customer-birth-overlay customer-calendar-overlay" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
      <button type="button" className="customer-birth-backdrop" aria-label="ปิดตัวเลือกวันเกิด" onClick={()=>setOpen(false)}/>
      <section ref={panel} className="customer-calendar" aria-label="ปฏิทินวันเกิด">
        <header><span><CalendarDays size={17}/><h2 id={`${id}-title`}>วันเกิดของคุณ</h2></span><button type="button" aria-label="ปิด" onClick={()=>setOpen(false)}><X size={18}/></button></header>
        <div className="customer-calendar-toolbar">
          <button type="button" aria-label={view==="year"?"ช่วงปีก่อนหน้า":"เดือนก่อนหน้า"} disabled={view==="year"?yearPage<=1900:draft.year===1900&&draft.month===1} onClick={()=>move(-1)}><ChevronLeft size={17}/></button>
          <div><button type="button" className={view==="month"?"active":""} onClick={()=>setView(view==="month"?"day":"month")}>{months[draft.month-1]}</button><button type="button" className={view==="year"?"active":""} onClick={()=>{setYearPage(Math.max(1900,draft.year-5));setView(view==="year"?"day":"year");}}>{draft.year+543}</button></div>
          <button type="button" aria-label={view==="year"?"ช่วงปีถัดไป":"เดือนถัดไป"} disabled={view==="year"?yearPage+11>=currentYear:draft.year===currentYear&&draft.month===12} onClick={()=>move(1)}><ChevronRight size={17}/></button>
        </div>
        <div className="customer-calendar-body">
          {view==="day"?<><div className="customer-calendar-week">{["อา","จ","อ","พ","พฤ","ศ","ส"].map(day=><span key={day}>{day}</span>)}</div><div className="customer-calendar-days">{Array.from({length:firstDay},(_,i)=><span key={`empty-${i}`}/>)}{Array.from({length:countDays(draft.year,draft.month)},(_,i)=>i+1).map(day=><button type="button" key={day} disabled={iso({...draft,day})>todayIso} aria-label={fullDate({...draft,day})} aria-pressed={draft.day===day} onClick={()=>setDraft({...draft,day})}>{day}</button>)}</div></>:
          view==="month"?<div className="customer-calendar-choices">{months.map((month,i)=><button type="button" key={month} aria-pressed={draft.month===i+1} onClick={()=>choose("month",i+1)}>{month}</button>)}</div>:
          <><p className="customer-calendar-year-range">พ.ศ. {yearPage+543} – {Math.min(yearPage+11,currentYear)+543}</p><div className="customer-calendar-choices">{Array.from({length:12},(_,i)=>yearPage+i).map(year=><button type="button" key={year} disabled={year<1900||year>currentYear} aria-pressed={draft.year===year} onClick={()=>choose("year",year)}>{year+543}</button>)}</div></>}
        </div>
        <footer><span aria-live="polite">{fullDate(draft)}</span><button type="button" disabled={!valid} onClick={()=>{onChange(iso(draft));setOpen(false);}}>ยืนยัน</button></footer>
      </section>
    </div>}
  </div>;
}
