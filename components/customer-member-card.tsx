"use client";

import Image from "next/image";
import { Crown, PawPrint, RotateCcw, ScanLine } from "lucide-react";
import { useState } from "react";

export function CustomerMemberCard({ name, level, points, memberCode, qr, preview }: {
  name: string; level: string; points: number; memberCode: string; qr: string; preview: boolean;
}) {
  const [flipped, setFlipped] = useState(false);
  return <section className={`customer-card-flip${flipped ? " is-flipped" : ""}`} aria-label="บัตรสมาชิก">
    <div className="customer-card-flip-inner">
      <div className="customer-home-member reference-member-card customer-card-front" aria-hidden={flipped} inert={flipped}>
        <div className="reference-member-copy">
          <div className="reference-card-brand">TAMMY PET SHOP <PawPrint size={14} /><small>MEMBERSHIP CARD</small></div>
          <span className="reference-card-rank"><Crown size={24} /> {level}</span>
          <strong className="reference-card-name">{name}</strong>
          <div className="reference-card-balance"><div><span>คะแนนสะสม</span><strong>{points.toLocaleString("th-TH")} <small>แต้ม</small></strong></div><button type="button" className="customer-card-flip-button" onClick={() => setFlipped(true)} aria-label="พลิกบัตรเพื่อดู QR สมาชิก"><ScanLine size={26} /><span>ดู QR</span></button></div>
          <div className="reference-card-progress"><i><span /></i><small>{preview ? "อีก 1,500 บาท ถึง Platinum" : `สมาชิกระดับ ${level}`}</small></div>
        </div>
        <span className="reference-card-slogan">เพื่อนซี้<br />ที่อยู่เคียงข้าง<br />เสมอ ♡</span>
      </div>
      <div className="customer-card-back" aria-hidden={!flipped} inert={!flipped}>
        <div><strong>QR สมาชิก</strong><span>{name}</span></div>
        {qr ? <Image src={qr} width={160} height={160} alt={preview ? "QR ตัวอย่าง ไม่สามารถใช้ทำรายการ" : "QR รหัสสมาชิกสำหรับให้พนักงานสแกน"} unoptimized /> : <span role="status">กำลังสร้าง QR…</span>}
        <span className="customer-card-code">{memberCode}</span>
        <button type="button" onClick={() => setFlipped(false)}><RotateCcw size={15} />กลับหน้าบัตร</button>
      </div>
    </div>
  </section>;
}
