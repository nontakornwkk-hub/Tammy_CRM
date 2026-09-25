"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Crown, Gift, RefreshCw, ShoppingCart, UserPlus, Users } from "lucide-react";
import { Sidebar } from "./sidebar";
import { DateRangePicker } from "./date-range-picker";
import { ReportMonthPicker } from "./report-month-picker";
import { supabase } from "@/lib/supabase/client";

type Member = { id:string; name:string; member_code:string; level:string; created_at:string; last_visit:string|null };
type Transaction = { id:string; member_id:string; sale_amount:number; points_delta:number; created_at:string; transaction_type:string };
const number = (n:number) => n.toLocaleString("th-TH", {maximumFractionDigits:2});
const dayKey = (value:string) => value.length === 10 ? value : new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value));
const shift = (day:string, amount:number) => new Date(Date.parse(day+"T12:00:00Z")+amount*86400000).toISOString().slice(0,10);
const dateLabel = (day:string) => new Intl.DateTimeFormat("th-TH", {day:"numeric",month:"short",year:"numeric"}).format(new Date(day+"T12:00:00Z"));
const buckets = [{label:"4–7 วัน",min:4,max:7},{label:"8–15 วัน",min:8,max:15},{label:"16–30 วัน",min:16,max:30},{label:"เกิน 30 วัน",min:31,max:Infinity}];
type Period = "day" | "week" | "month" | "custom";
const previousMonth = (day:string) => {
  const date=new Date(day+"T12:00:00Z");
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth()-1);
  return date.toISOString().slice(0,10);
};
const previousMonthEnd = (day:string) => {
  const first=previousMonth(day);
  const last=new Date(Date.UTC(Number(first.slice(0,4)),Number(first.slice(5,7)),0)).getUTCDate();
  return first.slice(0,7)+"-"+String(Math.min(Number(day.slice(8)),last)).padStart(2,"0");
};
const monthLastDay = (month:string) => new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
const monthName = (month:string) => new Intl.DateTimeFormat("th-TH",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(month+"-01T12:00:00Z"));
function periodRange(period:Exclude<Period,"custom">,end:string) {
  const weekday=(new Date(end+"T12:00:00Z").getUTCDay()+6)%7;
  const start=period==="day"?end:period==="week"?shift(end,-weekday):end.slice(0,7)+"-01";
  const previousStart=period==="month"?previousMonth(start):shift(start,period==="week"?-7:-1);
  const previousEnd=period==="month"?previousMonthEnd(end):shift(previousStart,Math.round((Date.parse(end)-Date.parse(start))/86400000));
  return {start,end,previousStart,previousEnd};
}
const percentLabel=(now:number,before:number,context:string) =>
  before===0?(now?"เพิ่มจาก 0 ใน"+context:"ไม่มีรายการทั้งสองช่วง"):
  ((now>before?"+":"")+number((now-before)/Math.abs(before)*100)+"% เทียบ"+context);

async function fetchRows<T>(table:string, columns:string):Promise<T[]> {
  if (!supabase) throw new Error("ยังไม่ได้เชื่อมต่อฐานข้อมูล");
  const rows:T[] = [];
  for (let offset=0;;offset+=1000) {
    const {data,error} = await supabase.from(table).select(columns).order("id").range(offset,offset+999);
    if (error) throw new Error(error.message);
    rows.push(...(data as unknown as T[]));
    if (!data || data.length<1000) return rows;
  }
}

export function ReportsManager() {
  const [range,setRange] = useState(() => { const today=dayKey(new Date().toISOString()); return {start:today.slice(0,7)+"-01",end:today}; });
  const [period,setPeriod] = useState<Period>("month");
  const [rankMonths,setRankMonths] = useState(() => {
    const today=dayKey(new Date().toISOString());
    return {current:today.slice(0,7),comparison:previousMonth(today).slice(0,7)};
  });
  const [draft,setDraft] = useState(range);
  const [members,setMembers] = useState<Member[]>([]);
  const [transactions,setTransactions] = useState<Transaction[]>([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const [reload,setReload] = useState(0);
  const [metric,setMetric] = useState<"sales"|"points">("sales");
  const [hover,setHover] = useState<number|null>(null);
  const [follow,setFollow] = useState<number|null>(null);
  const [customDays,setCustomDays] = useState(7);
  const compare=useMemo(()=>{
    if(period!=="custom")return periodRange(period,range.end);
    const days=Math.round((Date.parse(range.end)-Date.parse(range.start))/86400000)+1;
    return {...range,previousStart:shift(range.start,-days),previousEnd:shift(range.start,-1)};
  },[period,range]);
  const compareName=period==="day"?"วันก่อน":period==="week"?"สัปดาห์ก่อน":period==="month"?"เดือนก่อน":"ช่วงก่อน";
  function choosePeriod(next:Exclude<Period,"custom">) {
    const end=dayKey(new Date().toISOString()),nextRange=periodRange(next,end);
    setPeriod(next);setRange({start:nextRange.start,end});setDraft({start:nextRange.start,end});setHover(null);setFollow(null);
  }
  useEffect(() => {
    let active=true;
    setLoading(true); setError("");
    Promise.all([
      fetchRows<Member>("members","id,name,member_code,level,created_at,last_visit"),
      fetchRows<Transaction>("points_transactions","id,member_id,sale_amount,points_delta,created_at,transaction_type"),
    ]).then(([m,t]) => {if(active){setMembers(m);setTransactions(t);}})
      .catch(e => {if(active)setError(e instanceof Error ? e.message : "โหลดรายงานไม่สำเร็จ");})
      .finally(() => {if(active)setLoading(false);});
    return () => {active=false;};
  },[reload]);
  const report = useMemo(() => {
    const days=Math.round((Date.parse(range.end)-Date.parse(range.start))/86400000)+1;
    const earn=transactions.filter(t=>t.transaction_type==="earn");
    const stats=(start:string,end:string) => {
      const rows=earn.filter(t=> {const d=dayKey(t.created_at);return d>=start&&d<=end;});
      return [rows.reduce((s,t)=>s+Number(t.sale_amount),0),new Set(rows.map(t=>t.member_id)).size,
        rows.reduce((s,t)=>s+Math.max(0,Number(t.points_delta)),0),
        members.filter(m=>{const d=dayKey(m.created_at);return d>=start&&d<=end;}).length];
    };
    const series=Array.from({length:days},(_,i)=>({day:shift(range.start,i),sales:0,points:0}));
    const seriesMap=new Map(series.map(s=>[s.day,s]));
    const rank=new Map<string,{sales:number;points:number}>();
    const priorRank=new Map<string,{sales:number;points:number}>();
    const today=dayKey(new Date().toISOString());
    const rankStart=rankMonths.current+"-01";
    const partial=rankMonths.current===today.slice(0,7)||rankMonths.comparison===today.slice(0,7);
    const comparableDay=Number(today.slice(8));
    const rankEnd=partial?rankMonths.current+"-"+String(Math.min(comparableDay,Number(monthLastDay(rankMonths.current).slice(8)))).padStart(2,"0"):monthLastDay(rankMonths.current);
    const priorStart=rankMonths.comparison+"-01";
    const priorEnd=partial
      ? rankMonths.comparison+"-"+String(Math.min(comparableDay,Number(monthLastDay(rankMonths.comparison).slice(8)))).padStart(2,"0")
      : monthLastDay(rankMonths.comparison);
    const latest=new Map<string,string>();
    for(const t of earn) {
      const day=dayKey(t.created_at);
      if(day<=range.end && day>(latest.get(t.member_id)||""))latest.set(t.member_id,day);
      if(day>=priorStart&&day<=priorEnd) {
        const r=priorRank.get(t.member_id)||{sales:0,points:0};
        r.sales+=Number(t.sale_amount);r.points+=Math.max(0,Number(t.points_delta));priorRank.set(t.member_id,r);
      }
      if(day>=rankStart&&day<=rankEnd) {
        const r=rank.get(t.member_id)||{sales:0,points:0};
        r.sales+=Number(t.sale_amount);r.points+=Math.max(0,Number(t.points_delta));rank.set(t.member_id,r);
      }
      const item=seriesMap.get(day);
      if(!item)continue;
      const sales=Number(t.sale_amount),points=Math.max(0,Number(t.points_delta));
      item.sales+=sales;item.points+=points;
    }
    const byId=new Map(members.map(m=>[m.id,m]));
    const previousPlaces=new Map([...priorRank].sort((a,b)=>b[1][metric]-a[1][metric]||a[0].localeCompare(b[0])).map(([id],i)=>[id,i+1]));
    const ranking=[...rank].map(([id,r])=>({...r,id,member:byId.get(id),prior:priorRank.get(id)?.[metric]??0,oldPlace:previousPlaces.get(id)??null})).sort((a,b)=>b[metric]-a[metric]||a.id.localeCompare(b.id)).slice(0,10);
    const inactive=members.filter(m=>dayKey(m.created_at)<=range.end).map(m=>{
      const legacy=m.last_visit ? dayKey(m.last_visit) : "";
      const date=[latest.get(m.id)||"",legacy<=range.end?legacy:""].sort().at(-1)||"";
      return {...m,days:date?Math.round((Date.parse(range.end)-Date.parse(date))/86400000):null};
    });
    return {current:stats(range.start,range.end),previous:stats(compare.previousStart,compare.previousEnd),series,ranking,inactive};
  },[members,transactions,range,metric,compare,rankMonths]);
  const rankMove=(oldPlace:number|null,place:number) => oldPlace===null?"ใหม่":oldPlace===place?"คงที่":oldPlace>place?"▲ ขึ้น "+(oldPlace-place):"▼ ลง "+(place-oldPlace);
  const cards=[{label:"ยอดซื้อที่บันทึก",icon:ShoppingCart,unit:"บาท"},{label:"ลูกค้าที่ซื้อ",icon:Users,unit:"คน"},{label:"แต้มที่ให้",icon:Gift,unit:"แต้ม"},{label:"สมาชิกใหม่",icon:UserPlus,unit:"คน"}];
  const peak=Math.max(1,...report.series.map(s=>s[metric]));
  const x=(i:number)=>50+(report.series.length===1?360:i/(report.series.length-1)*720);
  const y=(value:number)=>230-value/peak*185;
  const line=report.series.map((s,i)=>(i?"L":"M")+x(i)+","+y(s[metric])).join(" ");
  const point=hover===null?null:report.series[hover];
  const pointBefore=point===null?null:transactions.filter(t=>t.transaction_type==="earn"&&dayKey(t.created_at)===(period==="month"?previousMonthEnd(point.day):shift(compare.previousStart,hover??0))).reduce((sum,t)=>sum+(metric==="sales"?Number(t.sale_amount):Math.max(0,Number(t.points_delta))),0);
  const selected=follow===null?[]:report.inactive.filter(m=>m.days!==null&&(follow===4?m.days>=customDays:m.days>=buckets[follow].min&&m.days<=buckets[follow].max));
  return <div className="app-shell reports-page">
    <div className="sidebar-wrap"><Sidebar activePath="/reports"/></div>
    <main className="main-content">
      <header className="page-header"><div className="heading-copy"><h1>วิเคราะห์และรายงาน</h1><p>มองภาพรวมร้าน แล้วดูแลลูกค้าให้ใกล้ชิดขึ้น</p></div>
        <div className="report-controls"><DateRangePicker start={draft.start} end={draft.end} onChange={(start,end)=>{setDraft({start,end});if(start&&end){setRange({start,end});setPeriod("custom");setHover(null);}}}/><button className="button outline" aria-label="รีเฟรชรายงาน" disabled={loading} onClick={()=>setReload(n=>n+1)}><RefreshCw size={18}/></button></div>
      </header>
      <div className="report-period" role="group" aria-label="ช่วงเวลาเปรียบเทียบ"><span>ดูผลแบบ</span>{([["day","รายวัน"],["week","รายสัปดาห์"],["month","รายเดือน"]] as const).map(([key,label])=><button type="button" key={key} aria-pressed={period===key} onClick={()=>choosePeriod(key)}>{label}</button>)}{period==="custom"?<span className="report-custom-active">ช่วงที่กำหนดเอง</span>:null}<small>เทียบ {dateLabel(compare.previousStart)} – {dateLabel(compare.previousEnd)}</small></div>
      {loading?<section className="report-state" role="status">กำลังรวบรวมข้อมูลร้าน…</section>:error?<section className="report-state" role="alert"><h2>ยังโหลดรายงานไม่ได้</h2><p>{error}</p><button className="button outline" onClick={()=>setReload(n=>n+1)}>ลองอีกครั้ง</button></section>:<>
      <div className="report-layout"><div className="report-left">
        <div className="report-kpis">{cards.map(({label,icon:Icon,unit},i)=>{
          const before=report.previous[i],now=report.current[i];
          return <article key={label}><Icon size={26}/><div><span>{label}</span><strong>{i===0?"฿":""}{number(now)}{i===1||i===3?" คน":""}</strong><small className={before>now?"down":""}>{percentLabel(now,before,compareName)}</small><span className="report-sr">{unit}</span></div></article>;
        })}</div>
        <section className="panel report-chart"><div className="report-section-head"><div><h2>แนวโน้มรายวัน</h2><p>{dateLabel(range.start)} – {dateLabel(range.end)}</p></div><div className="report-segment"><button aria-pressed={metric==="sales"} onClick={()=>{setMetric("sales");setHover(null);}}>ยอดซื้อ</button><button aria-pressed={metric==="points"} onClick={()=>{setMetric("points");setHover(null);}}>แต้มที่ให้</button></div></div>
          <div className="report-chart-value" aria-live="polite">{point?dateLabel(point.day):"เลือกจุดบนกราฟเพื่อดูรายละเอียด"}<strong>{point?(metric==="sales"?"฿":"")+number(point[metric])+(metric==="points"?" แต้ม":""):" "}</strong></div>
          {pointBefore!==null?<p className="report-point-compare">{percentLabel(point?.[metric]??0,pointBefore,compareName)}</p>:null}
          <svg viewBox="0 0 800 275" role="group" aria-label={metric==="sales"?"กราฟยอดซื้อรายวัน":"กราฟแต้มที่ให้รายวัน"}>
            <defs><linearGradient id="report-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f38289" stopOpacity=".3"/><stop offset="100%" stopColor="#f38289" stopOpacity=".02"/></linearGradient></defs>
            {[0,.25,.5,.75,1].map(n=><g key={n}><line x1="50" x2="770" y1={y(peak*n)} y2={y(peak*n)} stroke="#e5edf6"/><text x="42" y={y(peak*n)+4} textAnchor="end">{number(peak*n)}</text></g>)}
            <path d={line+" L"+x(report.series.length-1)+",230 L"+x(0)+",230 Z"} fill="url(#report-fill)"/>
            <path d={line} fill="none" stroke="#f1757c" strokeWidth="3" strokeLinejoin="round"/>
            {report.series.map((s,i)=><g key={s.day}><circle cx={x(i)} cy={y(s[metric])} r={hover===i?7:4} fill="#f1757c" stroke="white" strokeWidth="2" tabIndex={0} role="button" aria-label={dateLabel(s.day)+" "+number(s[metric])+(metric==="sales"?" บาท":" แต้ม")} onFocus={()=>setHover(i)} onMouseEnter={()=>setHover(i)} onClick={()=>setHover(i)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" ")setHover(i);}}/>{(i===0||i===report.series.length-1||i%Math.max(1,Math.ceil(report.series.length/6))===0)?<text x={x(i)} y="258" textAnchor="middle">{s.day.slice(8)}/{s.day.slice(5,7)}</text>:null}</g>)}
          </svg>
          {!report.current[1]?<p className="report-note">ยังไม่มีรายการซื้อในช่วงวันที่เลือก</p>:null}
        </section>
        <section className="panel report-follow"><div className="report-section-head"><div><h2><Clock3 size={23}/> ลูกค้าที่ต้องติดตาม</h2><p>จำนวนวันที่ไม่ได้ซื้อ ณ {dateLabel(range.end)} · แต่ละกลุ่มไม่นับซ้ำ</p></div></div>
          <div className="report-follow-grid">{buckets.map((b,i)=><button key={b.label} onClick={()=>setFollow(follow===i?null:i)} aria-expanded={follow===i}><Users size={23}/><span>{b.label}<strong>{report.inactive.filter(m=>m.days!==null&&m.days>=b.min&&m.days<=b.max).length} คน</strong></span></button>)}</div>
          <div className="report-custom"><label>กำหนดเอง: ไม่ได้ซื้ออย่างน้อย <input aria-label="จำนวนวันที่ต้องการติดตาม" type="number" min="1" max="3650" value={customDays} onChange={e=>setCustomDays(Math.max(1,Math.min(3650,Number(e.target.value)||1)))}/> วัน</label><button className="button outline" onClick={()=>setFollow(follow===4?null:4)} aria-expanded={follow===4}>ดูรายชื่อ</button></div>
          {follow!==null?<div className="report-follow-list"><h3>{follow===4?"ไม่ได้ซื้ออย่างน้อย "+customDays+" วัน":buckets[follow].label} · {selected.length} คน</h3>{selected.length?selected.sort((a,b)=>(b.days||0)-(a.days||0)).map(m=><div key={m.id}><span><strong>{m.name}</strong><small>{m.member_code}</small></span><span>{m.days} วัน</span></div>):<p>ไม่มีลูกค้าในกลุ่มนี้</p>}</div>:null}
          <p className="report-note">ยังไม่มีประวัติซื้อ {report.inactive.filter(m=>m.days===null).length} คน · แยกจากกลุ่มติดตาม</p>
        </section>
      </div><section className="panel report-leaderboard"><div className="report-section-head"><div><h2><Crown size={25}/> ลูกค้ายอดเยี่ยม</h2><p>10 อันดับตาม{metric==="sales"?"ยอดซื้อ":"แต้มที่ได้รับ"}</p></div></div>
        <div className="report-rank-months">
          <ReportMonthPicker label="อันดับเดือน" value={rankMonths.current} onChange={current=>setRankMonths(previous=>({current,comparison:current===previous.comparison?previousMonth(current+"-01").slice(0,7):previous.comparison}))}/>
          <span aria-hidden="true">เทียบกับ</span>
          <ReportMonthPicker label="เดือนที่เทียบ" value={rankMonths.comparison} exclude={rankMonths.current} align="right" onChange={comparison=>setRankMonths(previous=>({...previous,comparison}))}/>
        </div>
        {report.ranking.length?<><div className="report-podium">{[1,0,2].map(index=>{const row=report.ranking[index];return row?<article className={"place-"+(index+1)} key={row.id}><div className="report-podium-person"><div className="report-rank-avatar">{row.member?.name.slice(0,1)||"?"}</div><strong>{row.member?.name||"สมาชิกที่ถูกลบ"}</strong><span className={"member-badge "+(row.member?.level||"member").toLowerCase()}>{row.member?.level||"—"}</span><b>{metric==="sales"?"฿":""}{number(row[metric])}{metric==="points"?" แต้ม":""}</b></div><div className="report-podium-bar"><span>#{index+1}</span></div><div className="report-podium-detail"><small className={"report-rank-change "+(row.oldPlace!==null&&row.oldPlace<index+1?"down":"")}>{rankMove(row.oldPlace,index+1)}</small><small className={row[metric]<row.prior?"down":""}>{percentLabel(row[metric],row.prior,"เดือนที่เทียบ")}</small></div></article>:<div key={index}/>;})}</div>
          <div className="report-rank-table"><div className="report-rank-heading"><span>#</span><span>ลูกค้า / ระดับปัจจุบัน</span><span>{metric==="sales"?"ยอดซื้อ":"แต้ม"}</span></div>{report.ranking.slice(3).map((row,i)=><div key={row.id}><b>{i+4}</b><span><strong>{row.member?.name||"สมาชิกที่ถูกลบ"}</strong><small>{row.member?.level||"—"} · <span className={"report-rank-change "+(row.oldPlace!==null&&row.oldPlace<i+4?"down":"")}>{rankMove(row.oldPlace,i+4)}</span></small><small className={row[metric]<row.prior?"down":""}>{percentLabel(row[metric],row.prior,"เดือนที่เทียบ")}</small></span><b>{metric==="sales"?"฿":""}{number(row[metric])}{metric==="points"?" แต้ม":""}</b></div>)}</div></>:<div className="report-state">ยังไม่มีอันดับในเดือนนี้</div>}
        <p className="report-note">อันดับใช้เดือนที่เลือกในส่วนนี้ · ระดับสมาชิกเป็นระดับปัจจุบัน</p>
      </section></div><p className="report-footnote">ยอดซื้อและแต้มคำนวณจากรายการให้แต้มที่บันทึกสำเร็จ ไม่ใช่รายรับจากระบบบัญชี · ถ้าเลือกเดือนปัจจุบัน จะเทียบถึงวันที่เดียวกันของทั้งสองเดือน</p>
      </>}
    </main>
  </div>;
}
