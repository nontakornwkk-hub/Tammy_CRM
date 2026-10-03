"use client";
import Image from "next/image";
import { Crown, PawPrint, RotateCw } from "lucide-react";
import { useState, type CSSProperties } from "react";
export type RankProgress = { percent:number; remaining:number; next:string|null };
export function CustomerMemberCard({name,level,points,memberCode,qr,preview,progress}:{name:string;level:string;points:number;memberCode:string;qr:string;preview:boolean;progress?:RankProgress|null}) {
  const [flipped,setFlipped]=useState(false);
  const rank=["member","silver","gold","platinum"].includes(level.toLowerCase())?level.toLowerCase():"member";
  const percentage=Math.max(0,Math.min(100,progress?.percent??(rank==="platinum"?100:0)));
  return <section className={`customer-card-flip metallic-membership${flipped?" is-flipped":""}`} aria-label="บัตรสมาชิก">
    <button type="button" className="customer-card-flip-inner" onClick={()=>setFlipped(value=>!value)} aria-label={flipped?"พลิกกลับด้านหน้าบัตรสมาชิก":"พลิกบัตรเพื่อดู QR สมาชิก"} aria-pressed={flipped}>
      <div className={`metallic-card metallic-card-front rank-${rank}`} aria-hidden={flipped} inert={flipped}>
        <div className="metallic-card-copy"><div className="metallic-wordmark">tammy<PawPrint size={22} fill="currentColor"/><small>petshop</small></div><span className="metallic-rank"><Crown size={18} fill="currentColor"/>{level.toUpperCase()}</span><span className="metallic-balance-label">แต้มคงเหลือ</span><div className={`metallic-balance${points>=100000?" is-large":""}`}><strong>{points.toLocaleString("th-TH")}</strong><span>แต้ม</span></div><div className="metallic-progress" style={{"--rank-progress":`${percentage}%`} as CSSProperties} aria-label={`ความคืบหน้าระดับสมาชิก ${percentage.toFixed(1)} เปอร์เซ็นต์`}><i/><span>{percentage.toLocaleString("th-TH",{maximumFractionDigits:1})}%</span></div><p>{rank==="platinum"?"คุณอยู่ระดับสูงสุดแล้ว":progress?.next?`อีก ${progress.remaining.toLocaleString("th-TH")} บาท เพื่อขึ้น ${progress.next}`:"ระดับสมาชิกตามยอดซื้อสะสม"}</p></div>
      </div>
      <div className={`metallic-card metallic-card-back rank-${rank}`} aria-hidden={!flipped} inert={!flipped}>
        <header><div className="metallic-wordmark">tammy<PawPrint size={19} fill="currentColor"/><small>petshop</small></div><span className="metallic-rank"><Crown size={16} fill="currentColor"/>{level.toUpperCase()}</span></header><div className="metallic-qr">{qr?<Image src={qr} width={180} height={180} alt={preview?"QR ตัวอย่าง ไม่สามารถใช้ทำรายการ":"QR สมาชิกสำหรับให้พนักงานสแกน"} unoptimized/>:<span role="status">กำลังสร้าง QR…</span>}</div><strong className="metallic-qr-caption">แสดงให้พนักงานสแกน</strong><span className="metallic-member-code">{name} · {memberCode}</span><PawPrint className="metallic-back-paw" size={36} fill="currentColor" aria-hidden="true"/>
      </div>
    </button><p className="customer-card-flip-hint"><RotateCw size={13}/>แตะบัตรเพื่อพลิกดู{flipped?"ด้านหน้า":"รหัสสมาชิก"}</p>
  </section>;
}
