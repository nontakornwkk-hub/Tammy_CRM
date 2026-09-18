"use client";

import Image from "next/image";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Crown,
  Gift,
  History,
  Menu,
  PawPrint,
  Pin,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { defaultSettings, loadSettings } from "@/lib/settings";
import { Sidebar } from "./sidebar";

type MemberLevel = "Gold" | "Silver" | "Member";
type Customer = {
  id: number;
  name: string;
  nickname: string;
  phone: string;
  level: MemberLevel;
  points: number;
  pinned: boolean;
};

const initialCustomers: Customer[] = [
  { id: 1, name: "คุณรนภัทร วงศ์ศรี", nickname: "พี่โบ๊ท", phone: "081-234-5678", level: "Gold", points: 2480, pinned: true },
  { id: 2, name: "คุณกมลวรรณ ใจดี", nickname: "แม่มิ้นท์", phone: "082-345-6789", level: "Silver", points: 920, pinned: false },
  { id: 3, name: "คุณศิริภพ พูลทรัพย์", nickname: "พี่เกมส์", phone: "083-456-7890", level: "Member", points: 310, pinned: true },
  { id: 4, name: "คุณนันทิตา สวัสดิ์ผล", nickname: "แม่น้ำ", phone: "084-567-8901", level: "Gold", points: 1760, pinned: false },
  { id: 5, name: "คุณพงศธร รัตนกุล", nickname: "พี่ต้น", phone: "085-678-9012", level: "Silver", points: 640, pinned: false },
  { id: 6, name: "คุณชลิตา กมลสุข", nickname: "น้องเมย์", phone: "086-789-0123", level: "Member", points: 220, pinned: true },
  { id: 7, name: "คุณอรรถพล จันทร์ดี", nickname: "พี่อาร์ม", phone: "087-890-1234", level: "Gold", points: 3120, pinned: false },
  { id: 8, name: "คุณวิไลลักษณ์ ครองสุข", nickname: "แม่แอน", phone: "088-901-2345", level: "Silver", points: 980, pinned: true },
  { id: 9, name: "คุณภัทรวดี เมฆสว่าง", nickname: "น้องจิม", phone: "089-012-3456", level: "Member", points: 415, pinned: false },
  { id: 10, name: "คุณธนพล ศรีสมบัติ", nickname: "พี่นนท์", phone: "090-123-4567", level: "Silver", points: 760, pinned: false },
];

const levelClass: Record<MemberLevel, string> = { Gold: "gold", Silver: "silver", Member: "member" };
const recentTransactions = [
  ["14 มี.ค. 2568", "คุณกมลวรรณ (แม่มิ้นท์)", "680 บาท", "+13"],
  ["14 มี.ค. 2568", "คุณพงศธร (พี่ต้น)", "2,400 บาท", "+48"],
  ["13 มี.ค. 2568", "คุณนันทิตา (แม่น้ำ)", "950 บาท", "+19"],
  ["12 มี.ค. 2568", "คุณศิริภพ (พี่เกมส์)", "1,500 บาท", "+30"],
  ["11 มี.ค. 2568", "คุณชลิตา (น้องเมย์)", "420 บาท", "+8"],
];

export function PointsManager() {
  const [customers, setCustomers] = useState(initialCustomers);
  const [selectedId, setSelectedId] = useState(1);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ทั้งหมด" | "ปักหมุด" | "ใช้งานล่าสุด">("ทั้งหมด");
  const [sale, setSale] = useState(1250);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState({ earned: 0, total: 0 });
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [systemSettings, setSystemSettings] = useState(defaultSettings);
  const selected = customers.find((customer) => customer.id === selectedId) ?? customers[0];
  const earned = Math.floor(sale / systemSettings.pointsSpend) * systemSettings.pointsEarned * systemSettings.promotionMultiplier;

  useEffect(() => {
    setSystemSettings(loadSettings());
    const update = () => setSystemSettings(loadSettings());
    window.addEventListener("tammy-settings-changed", update);
    return () => window.removeEventListener("tammy-settings-changed", update);
  }, []);

  const visible = useMemo(() => customers.filter((customer) => {
    const searchMatch = `${customer.name} ${customer.nickname} ${customer.phone}`.includes(query.trim());
    const filterMatch = filter === "ทั้งหมด" || filter === "ใช้งานล่าสุด" || customer.pinned;
    return searchMatch && filterMatch;
  }), [customers, filter, query]);

  function confirmPoints() {
    setSuccessReceipt({ earned, total: selected.points + earned });
    setCustomers((current) => current.map((customer) => customer.id === selectedId ? { ...customer, points: customer.points + earned } : customer));
    setConfirmOpen(false);
    setSuccessOpen(true);
  }

  function togglePin(id: number) {
    setCustomers((current) => current.map((customer) => customer.id === id ? { ...customer, pinned: !customer.pinned } : customer));
  }

  return (
    <div className="app-shell points-page">
      <div className={`mobile-overlay${mobileMenu ? " show" : ""}`} onClick={() => setMobileMenu(false)} />
      <div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/points" /></div>
      <main className="main-content">
        <header className="page-header points-header">
          <button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button>
          <div className="title-icon"><Gift /></div>
          <div className="heading-copy"><h1>ให้แต้มลูกค้า</h1><p>ค้นหาสมาชิก ใส่ยอดซื้อ และให้แต้มได้ในขั้นตอนเดียว</p></div>
          <div className="header-actions"><span className="ready"><i /> พร้อมใช้งาน</span><button className="button outline" type="button" onClick={() => setShowAllHistory((current) => !current)}><History size={18} /> {showAllHistory ? "ซ่อนประวัติ" : "ดูประวัติทั้งหมด"}</button></div>
        </header>

        <div className="points-workspace">
          <section className="panel customer-panel">
            <div className="step-heading"><span>1</span><h2>เลือกลูกค้า</h2></div>
            <label className="customer-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาจากชื่อ ชื่อเล่น หรือเบอร์โทรศัพท์" /></label>
            <div className="customer-filters">
              {([
                ["ทั้งหมด", Pin],
                ["ปักหมุด", Pin],
                ["ใช้งานล่าสุด", Clock3],
              ] as const).map(([name, Icon]) => <button type="button" key={name} className={filter === name ? "active" : ""} onClick={() => setFilter(name)}><Icon size={16} /> {name}</button>)}
            </div>
            <div className="customer-table">
              <div className="customer-head"><span>ลูกค้า</span><span>ชื่อที่จำ</span><span>เบอร์โทรศัพท์</span><span>ระดับสมาชิก</span><span>แต้มปัจจุบัน</span><span>ปักหมุด</span><span /></div>
              <div>
                {visible.map((customer) => <article key={customer.id} className={`customer-row${selectedId === customer.id ? " selected" : ""}`} onClick={() => setSelectedId(customer.id)}>
                  <span className="pet-avatar"><Image src="/assets/tammy-logo-cat.png" alt="" width={44} height={44} /></span>
                  <span className="customer-name">{customer.name}</span>
                  <strong>{customer.nickname}</strong>
                  <span>{customer.phone}</span>
                  <span className={`member-badge ${levelClass[customer.level]}`}>{customer.level === "Gold" ? <Crown size={14} /> : <PawPrint size={14} />}{customer.level}</span>
                  <strong>{customer.points.toLocaleString()}</strong>
                  <button type="button" className={`pin-button${customer.pinned ? " active" : ""}`} onClick={(event) => { event.stopPropagation(); togglePin(customer.id); }} aria-label={`ปักหมุด ${customer.name}`}><Pin size={18} /></button>
                  <span className={`radio${selectedId === customer.id ? " checked" : ""}`}>{selectedId === customer.id && <Check size={13} />}</span>
                </article>)}
              </div>
            </div>
          </section>

          <aside className="points-side">
            <section className="panel points-summary">
              <div className="step-heading"><span>2</span><h2>ให้แต้มและสรุป</h2></div>
              <div className="selected-customer">
                <span className="pet-avatar large"><Image src="/assets/tammy-logo-cat.png" alt="" width={58} height={58} /></span>
                <div><strong>{selected.name} ({selected.nickname})</strong><small>☎ {selected.phone}</small></div>
                <span className={`member-badge ${levelClass[selected.level]}`}><Crown size={15} />{selected.level}</span>
              </div>
              <div className="sale-input"><label>ยอดซื้อ</label><div><input type="number" value={sale} onChange={(event) => setSale(Math.max(0, Number(event.target.value)))} /><span>บาท</span></div><small>ทุกยอดซื้อ {systemSettings.pointsSpend} บาท = {systemSettings.pointsEarned} แต้ม</small></div>
              <div className="promotion-banner"><Image src="/assets/tammy-logo-cat.png" alt="" width={80} height={70} /><div><strong>โปรโมชั่นสุดใจ • แต้ม x{systemSettings.promotionMultiplier}</strong><span>ช้อปวันนี้ รับแต้มคูณ ความสุขมีได้ทุกวัน!</span></div><b>กำลังใช้งาน</b></div>
              <div className="calculation"><p><span>ยอดซื้อ</span><strong>{sale.toLocaleString()} บาท</strong></p><p><span>แต้มพื้นฐาน (ทุก {systemSettings.pointsSpend} บาท = {systemSettings.pointsEarned} แต้ม)</span><strong>{Math.floor(sale / systemSettings.pointsSpend) * systemSettings.pointsEarned} แต้ม</strong></p><p><span>ตัวคูณโปรโมชั่น</span><strong>x{systemSettings.promotionMultiplier}</strong></p></div>
              <div className="earned"><span><PawPrint /> แต้มที่จะได้รับ</span><strong>+{earned} แต้ม</strong></div>
              <div className="points-before-after"><div><span>แต้มปัจจุบัน</span><strong>{selected.points.toLocaleString()} แต้ม</strong></div><b>→</b><div><span>หลังทำรายการ</span><strong>{(selected.points + earned).toLocaleString()} แต้ม</strong></div></div>
              <p className="check-notice">● ตรวจสอบยอดซื้อก่อนยืนยัน</p>
              <button className="confirm-points" type="button" onClick={() => setConfirmOpen(true)}><Gift /> ยืนยันให้แต้ม</button>
            </section>

            <section className="panel recent-points">
              <div className="recent-title"><h3><Clock3 /> รายการล่าสุด</h3><button type="button" onClick={() => setShowAllHistory((current) => !current)}>{showAllHistory ? "แสดงน้อยลง" : "ดูทั้งหมด ›"}</button></div>
              <div className="recent-head"><span>วันที่</span><span>ลูกค้า</span><span>ยอดซื้อ</span><span>แต้มที่ได้รับ</span></div>
              {recentTransactions.slice(0, showAllHistory ? recentTransactions.length : 3).map((row) => <div className="recent-row" key={row[1]}>{row.map((cell, index) => <span className={index === 3 ? "green" : ""} key={cell}>{cell}</span>)}</div>)}
            </section>
            <div className="secure-note"><ShieldCheck /><span><strong>ข้อมูลลูกค้าปลอดภัย</strong><small>รายการทั้งหมดได้รับการบันทึกอย่างปลอดภัย</small></span></div>
          </aside>
        </div>
        {confirmOpen ? (
          <div className="preview-modal points-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-points-title">
            <button className="preview-backdrop" type="button" aria-label="ยกเลิก" onClick={() => setConfirmOpen(false)} />
            <section>
              <button className="preview-close" type="button" onClick={() => setConfirmOpen(false)} aria-label="ปิด"><X /></button>
              <span className="confirm-icon"><AlertTriangle /></span>
              <h2 id="confirm-points-title">ยืนยันการให้แต้ม?</h2>
              <p>กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนทำรายการ</p>
              <div className="confirm-customer">
                <span className="pet-avatar"><Image src="/assets/tammy-logo-cat.png" alt="" width={44} height={44} /></span>
                <span><strong>{selected.name}</strong><small>{selected.nickname} • {selected.phone}</small></span>
              </div>
              <div className="confirm-summary">
                <p><span>ยอดซื้อ</span><strong>{sale.toLocaleString()} บาท</strong></p>
                <p><span>แต้มที่จะได้รับ</span><strong className="green">+{earned} แต้ม</strong></p>
                <p><span>แต้มหลังทำรายการ</span><strong>{(selected.points + earned).toLocaleString()} แต้ม</strong></p>
              </div>
              <div className="confirm-actions">
                <button type="button" onClick={() => setConfirmOpen(false)}>ยกเลิก</button>
                <button type="button" onClick={confirmPoints}><Gift size={18} /> ยืนยันการให้แต้ม</button>
              </div>
            </section>
          </div>
        ) : null}
        {successOpen ? (
          <div className="preview-modal points-success-modal" role="dialog" aria-modal="true" aria-labelledby="points-success-title">
            <button className="preview-backdrop" type="button" aria-label="ปิด" onClick={() => setSuccessOpen(false)} />
            <section>
              <button className="preview-close" type="button" onClick={() => setSuccessOpen(false)} aria-label="ปิด"><X /></button>
              <span className="success-icon"><CheckCircle2 /></span>
              <h2 id="points-success-title">ให้แต้มสำเร็จ!</h2>
              <p>ระบบบันทึกรายการเรียบร้อยแล้ว</p>
              <div className="success-customer"><span className="pet-avatar"><Image src="/assets/tammy-logo-cat.png" alt="" width={44} height={44} /></span><span><strong>{selected.name}</strong><small>{selected.nickname} • {selected.phone}</small></span></div>
              <div className="success-points"><span>ได้รับ</span><strong>+{successReceipt.earned} แต้ม</strong><small>แต้มคงเหลือใหม่ {successReceipt.total.toLocaleString()} แต้ม</small></div>
              <button className="success-done" type="button" onClick={() => setSuccessOpen(false)}>เสร็จสิ้น</button>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
