"use client";

import Image from "next/image";
import {
  AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, CircleDollarSign,
  Download, Edit3, FileUp, Gift, Mail, MapPin, Menu, MessageCircle, MoreVertical,
  PawPrint, Phone, Plus, Search, SlidersHorizontal, Tag, UserCheck, UserMinus,
  UserPlus, Users, X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Sidebar } from "./sidebar";

type Level = "Gold" | "Silver" | "Member";
type Status = "ใช้งาน" | "ไม่ได้ใช้งาน";
type Member = {
  id: number; name: string; phone: string; email: string; level: Level; points: number;
  spending: number; lastVisit: string; status: Status; petNames: string[]; tags: string[];
};

const initialMembers: Member[] = [
  { id: 1, name: "คุณศิริพร กมลดี", phone: "081-234-5678", email: "siriporn@email.com", level: "Gold", points: 1250, spending: 24560, lastVisit: "12 ต.ค. 2568", status: "ใช้งาน", petNames: ["น้องข้าว", "น้องตัง"], tags: ["ลูกค้าประจำ", "รักแมว"] },
  { id: 2, name: "คุณมะลิ จันทร์สุข", phone: "089-456-7890", email: "mali.jun@gmail.com", level: "Silver", points: 680, spending: 12340, lastVisit: "8 ต.ค. 2568", status: "ใช้งาน", petNames: ["น้องโมจิ", "น้องถั่ว"], tags: ["ลูกค้าประจำ", "รักแมว", "ครอบครัวใหญ่"] },
  { id: 3, name: "คุณรนภัทร วัฒนพงษ์", phone: "093-987-6543", email: "ronnapat@email.com", level: "Member", points: 320, spending: 4890, lastVisit: "5 ต.ค. 2568", status: "ใช้งาน", petNames: ["น้องมะขาม"], tags: ["รักแมว"] },
  { id: 4, name: "คุณนภัสชัย สิงห์วงศ์", phone: "065-415-9966", email: "napat@email.com", level: "Gold", points: 2340, spending: 36500, lastVisit: "2 ต.ค. 2568", status: "ใช้งาน", petNames: ["น้องคุกกี้"], tags: ["ลูกค้าประจำ"] },
  { id: 5, name: "คุณเพ็ญพล อิงอุ่น", phone: "086-778-2211", email: "penpol@email.com", level: "Member", points: 90, spending: 1260, lastVisit: "28 ก.ย. 2568", status: "ไม่ได้ใช้งาน", petNames: ["น้องชูชิ"], tags: ["ต้องติดตาม"] },
  { id: 6, name: "คุณนภา ใจดี", phone: "090-112-3344", email: "napa@email.com", level: "Silver", points: 540, spending: 9800, lastVisit: "20 ก.ย. 2568", status: "ใช้งาน", petNames: ["น้องโคโค่"], tags: ["รักสุนัข"] },
  { id: 7, name: "คุณจันทร์ เดชะ", phone: "082-665-7788", email: "chan@email.com", level: "Member", points: 180, spending: 3450, lastVisit: "15 ก.ย. 2568", status: "ใช้งาน", petNames: ["น้องมิดไนท์"], tags: ["รักแมว"] },
  { id: 8, name: "คุณกนกนภา รุ่งเรือง", phone: "099-445-6677", email: "kanok@email.com", level: "Gold", points: 1780, spending: 28900, lastVisit: "10 ก.ย. 2568", status: "ใช้งาน", petNames: ["น้องไผ่"], tags: ["ลูกค้าประจำ", "รักสุนัข"] },
];

const levelClass: Record<Level, string> = { Gold: "gold", Silver: "silver", Member: "member" };
const detailTabs = ["ภาพรวม", "สัตว์เลี้ยง", "ประวัติ", "โน้ต"] as const;
type DetailTab = typeof detailTabs[number];

export function MembersManager() {
  const [members, setMembers] = useState(initialMembers);
  const [selectedId, setSelectedId] = useState(2);
  const [checkedIds, setCheckedIds] = useState<number[]>([2]);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<"ทั้งหมด" | Level>("ทั้งหมด");
  const [status, setStatus] = useState<"ทั้งหมด" | Status>("ทั้งหมด");
  const [tagFilter, setTagFilter] = useState("ทั้งหมด");
  const [activeTab, setActiveTab] = useState<DetailTab>("ภาพรวม");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState("");

  const visible = useMemo(() => members.filter((member) => {
    const haystack = `${member.name} ${member.phone} ${member.email} ${member.petNames.join(" ")}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (level === "ทั้งหมด" || member.level === level) && (status === "ทั้งหมด" || member.status === status) && (tagFilter === "ทั้งหมด" || member.tags.includes(tagFilter));
  }), [members, query, level, status, tagFilter]);
  const selected = members.find((member) => member.id === selectedId) ?? members[0];
  const allVisibleChecked = visible.length > 0 && visible.every((member) => checkedIds.includes(member.id));

  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 1800); }
  function toggleChecked(id: number) { setCheckedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  function toggleAll() { setCheckedIds((current) => allVisibleChecked ? current.filter((id) => !visible.some((member) => member.id === id)) : [...new Set([...current, ...visible.map((member) => member.id)])]); }
  function exportMembers() {
    const rows = [["ชื่อ", "โทรศัพท์", "อีเมล", "ระดับ", "แต้ม", "ยอดซื้อสะสม"], ...members.map((member) => [member.name, member.phone, member.email, member.level, String(member.points), String(member.spending)])];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "tammy-members.csv"; link.click(); URL.revokeObjectURL(link.href); notify("ส่งออกรายชื่อแล้ว");
  }
  function addMember(form: FormData) {
    const name = String(form.get("name") || "สมาชิกใหม่"); const phone = String(form.get("phone") || "-");
    if (members.some((member) => member.phone === phone)) { notify("เบอร์โทรนี้มีในระบบแล้ว"); return; }
    const member: Member = { id: Date.now(), name, phone, email: String(form.get("email") || "-"), level: "Member", points: 0, spending: 0, lastVisit: "วันนี้", status: "ใช้งาน", petNames: [String(form.get("pet") || "ยังไม่ระบุ")], tags: ["สมาชิกใหม่"] };
    setMembers((current) => [member, ...current]); setSelectedId(member.id); setAddOpen(false); notify("เพิ่มสมาชิกเรียบร้อย");
  }

  return <div className="app-shell members-page">
    <div className={`mobile-overlay${mobileMenu ? " show" : ""}`} onClick={() => setMobileMenu(false)} />
    <div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/members" /></div>
    <main className="main-content">
      <header className="page-header members-header"><button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button><div className="title-icon"><Users /></div><div className="heading-copy"><h1>สมาชิก</h1><p>จัดการข้อมูลลูกค้า สัตว์เลี้ยง แต้ม และประวัติการใช้บริการ</p></div><div className="header-actions"><label className="button outline member-import"><FileUp size={17} /> นำเข้ารายชื่อ<input type="file" accept=".csv" onChange={() => notify("รับไฟล์รายชื่อแล้ว")} /></label><button className="button outline" type="button" onClick={exportMembers}><Download size={17} /> ส่งออก</button><button className="button primary" type="button" onClick={() => setAddOpen(true)}><Plus size={18} /> เพิ่มสมาชิก</button></div></header>

      <section className="member-metrics">
        <Metric icon={<Users />} label="สมาชิกทั้งหมด" value="1,482 คน" note="เพิ่มขึ้น 12% จากเดือนที่แล้ว" tone="coral" />
        <Metric icon={<UserCheck />} label="ใช้งานเดือนนี้" value="892 คน" note="เพิ่มขึ้น 8% จากเดือนที่แล้ว" tone="green" />
        <Metric icon={<UserPlus />} label="สมาชิกใหม่" value="118 คน" note="เพิ่มขึ้น 24% จากเดือนที่แล้ว" tone="blue" />
        <Metric icon={<UserMinus />} label="ไม่ได้ใช้งาน" value="154 คน" note="ควรติดตาม 9 ราย" tone="orange" />
      </section>

      <div className="members-workspace">
        <section className="panel members-list-panel">
          <div className="member-tools"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ เบอร์โทร หรือชื่อสัตว์เลี้ยง" /></label><div className="member-level-filter">{(["ทั้งหมด", "Gold", "Silver", "Member"] as const).map((item) => <button className={level === item ? "active" : ""} type="button" key={item} onClick={() => setLevel(item)}>{item}</button>)}</div><button className="advanced-filter" type="button" onClick={() => setStatus((current) => current === "ทั้งหมด" ? "ใช้งาน" : current === "ใช้งาน" ? "ไม่ได้ใช้งาน" : "ทั้งหมด")}><SlidersHorizontal /> ตัวกรอง {status !== "ทั้งหมด" ? `• ${status}` : ""}</button></div>
          <div className="member-filter-row"><label>สถานะ<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option>ทั้งหมด</option><option>ใช้งาน</option><option>ไม่ได้ใช้งาน</option></select></label><label>แท็ก<select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}><option>ทั้งหมด</option><option>ลูกค้าประจำ</option><option>รักแมว</option><option>รักสุนัข</option><option>ต้องติดตาม</option></select></label><label>วันที่สมัคร<select><option>ทั้งหมด</option><option>เดือนนี้</option><option>3 เดือนล่าสุด</option></select></label><label>มาล่าสุด<select><option>ทั้งหมด</option><option>7 วันล่าสุด</option><option>30 วันล่าสุด</option></select></label></div>
          <div className="member-bulk"><button type="button" className={`bulk-check${allVisibleChecked ? " checked" : ""}`} onClick={toggleAll}>{allVisibleChecked ? <Check /> : null}</button><strong>เลือกแล้ว {checkedIds.length} รายการ</strong><button type="button" onClick={() => notify(`เตรียมส่งข้อความถึง ${checkedIds.length} ราย`)}><MessageCircle /> ส่งข้อความ</button><button type="button" onClick={() => notify("เพิ่มแท็กเรียบร้อย")}><Tag /> เพิ่มแท็ก</button><button type="button" onClick={exportMembers}><Download /> ส่งออก</button><button type="button" onClick={() => { setMembers((current) => current.map((member) => checkedIds.includes(member.id) ? { ...member, status: "ไม่ได้ใช้งาน" } : member)); notify("ปิดใช้งานรายการที่เลือกแล้ว"); }}><UserMinus /> ปิดใช้งาน</button></div>
          <div className="members-table"><div className="members-table-head"><button type="button" aria-label="เลือกทั้งหมด" className={`row-check${allVisibleChecked ? " checked" : ""}`} onClick={toggleAll}>{allVisibleChecked ? <Check /> : null}</button><span>ลูกค้า</span><span>สัตว์เลี้ยง</span><span>ระดับ</span><span>แต้ม</span><span>ยอดซื้อสะสม</span><span>มาล่าสุด</span><span>สถานะ</span><span /></div>{visible.map((member) => <article className={`members-table-row${selectedId === member.id ? " selected" : ""}`} key={member.id} onClick={() => setSelectedId(member.id)}><button type="button" aria-label={`เลือก ${member.name}`} className={`row-check${checkedIds.includes(member.id) ? " checked" : ""}`} onClick={(event) => { event.stopPropagation(); toggleChecked(member.id); }}>{checkedIds.includes(member.id) ? <Check /> : null}</button><MemberIdentity member={member} /><span className="pet-summary"><i>🐾</i><b>{member.petNames[0]}</b><small>{member.petNames.length > 1 ? `และอีก ${member.petNames.length - 1} ตัว` : "แมว • พันธุ์ไทย"}</small></span><span className={`member-badge ${levelClass[member.level]}`}>{member.level}</span><strong>{member.points.toLocaleString()}</strong><strong>฿{member.spending.toLocaleString()}</strong><span>{member.lastVisit}</span><span className={`member-status ${member.status === "ใช้งาน" ? "active" : "inactive"}`}><i />{member.status}</span><button className="row-more" type="button" aria-label="เมนูเพิ่มเติม" onClick={(event) => event.stopPropagation()}><MoreVertical /></button></article>)}</div>
          {visible.length === 0 ? <div className="members-empty"><Search /><strong>ไม่พบสมาชิก</strong><span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span></div> : null}
          <footer className="members-footer"><span>แสดง 1–{visible.length} จาก 1,482 รายการ</span><div><button type="button"><ChevronLeft /></button><button className="active" type="button">1</button><button type="button">2</button><button type="button">3</button><button type="button"><ChevronRight /></button></div><label>จำนวนต่อหน้า<select><option>8</option><option>20</option><option>50</option></select></label></footer>
        </section>

        <aside className="panel member-detail">
          <div className="member-detail-head"><span className="member-photo"><Image src="/assets/tammy-logo-cat.png" alt="" width={72} height={72} /></span><div><span className="active-pill"><i /> ใช้งาน</span><h2>{selected.name}</h2><small>รหัสสมาชิก #TM{String(selected.id).padStart(5, "0")}</small></div><button type="button" aria-label="เมนู"><MoreVertical /></button></div>
          <div className="member-contact-line"><span><Phone /> {selected.phone}</span><span><Mail /> {selected.email}</span><span><MapPin /> กรุงเทพมหานคร</span></div>
          <div className="member-quick-actions"><button type="button" onClick={() => notify("เปิดขั้นตอนให้แต้มแล้ว")}><Gift /> ให้แต้ม</button><button type="button" onClick={() => notify(`เตรียมส่งข้อความถึง ${selected.name}`)}><MessageCircle /> ส่งข้อความ</button><button type="button" onClick={() => notify("เปิดโหมดแก้ไขแล้ว")}><Edit3 /> แก้ไข</button></div>
          <nav className="member-detail-tabs">{detailTabs.map((tab) => <button type="button" className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
          {activeTab === "ภาพรวม" ? <MemberOverview member={selected} setMembers={setMembers} /> : null}
          {activeTab === "สัตว์เลี้ยง" ? <PetDetails member={selected} /> : null}
          {activeTab === "ประวัติ" ? <HistoryDetails /> : null}
          {activeTab === "โน้ต" ? <NotesDetails onSave={() => notify("บันทึกโน้ตแล้ว")} /> : null}
        </aside>
      </div>
      {toast ? <div className="member-toast" role="status"><Check /> {toast}</div> : null}
      {addOpen ? <AddMemberModal close={() => setAddOpen(false)} submit={addMember} /> : null}
    </main>
  </div>;
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value: string; note: string; tone: string }) { return <article className={`member-metric ${tone}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><em>↑ {note}</em></div></article>; }
function MemberIdentity({ member }: { member: Member }) { return <span className="member-identity"><i><Image src="/assets/tammy-logo-cat.png" alt="" width={38} height={38} /></i><span><b>{member.name}</b><small>{member.phone}</small></span></span>; }

function MemberOverview({ member, setMembers }: { member: Member; setMembers: React.Dispatch<React.SetStateAction<Member[]>> }) {
  return <div className="member-detail-body"><div className="member-stat-grid"><article><small>ระดับสมาชิก</small><strong className={`member-badge ${levelClass[member.level]}`}>{member.level}</strong><span>ตั้งแต่ 15 ม.ค. 2566</span></article><article><small>แต้มปัจจุบัน</small><strong><CircleDollarSign /> {member.points.toLocaleString()} แต้ม</strong><span>ดูประวัติแต้ม ›</span></article><article><small>ยอดซื้อสะสม</small><strong>฿{member.spending.toLocaleString()}</strong><span>46 ครั้ง</span></article></div><section className="detail-section"><div className="detail-title"><h3>ข้อมูลติดต่อ</h3><button type="button"><Edit3 /> แก้ไข</button></div><p><Phone /> {member.phone}</p><p><Mail /> {member.email}</p><p><MapPin /> 123/45 เขตสุขุมวิท กรุงเทพฯ 10260</p><label className="consent-row"><span><Check /> ยินยอมรับข่าวสาร</span><input type="checkbox" defaultChecked /></label></section><section className="detail-section"><div className="detail-title"><h3>สัตว์เลี้ยง ({member.petNames.length} ตัว)</h3><button type="button"><Plus /> เพิ่มสัตว์เลี้ยง</button></div><div className="pet-cards">{member.petNames.map((pet, index) => <article key={pet}><span>{index % 2 ? "🐶" : "🐱"}</span><div><strong>{pet}</strong><small>{index % 2 ? "สุนัข • Chihuahua" : "แมว • Scottish Fold"}</small><em className={index ? "healthy" : "warning"}>{index ? "สุขภาพแข็งแรง" : "แพ้อาหารทะเล"}</em></div></article>)}</div></section><section className="detail-section"><div className="detail-title"><h3>แท็ก</h3><button type="button"><Edit3 /> แก้ไข</button></div><div className="detail-tags">{member.tags.map((tag) => <span key={tag}>{tag}</span>)}<button type="button" onClick={() => setMembers((current) => current.map((item) => item.id === member.id ? { ...item, tags: [...item.tags, "แท็กใหม่"] } : item))}>+ เพิ่มแท็ก</button></div></section><section className="detail-section"><div className="detail-title"><h3>โน้ตสั้น ๆ</h3><button type="button"><Edit3 /> แก้ไข</button></div><p className="member-note">ลูกค้าสั่งอาหารเม็ดสูตรแพ้ง่ายเป็นประจำ ชอบสินค้ากลุ่มอาหารแมวเกรดพรีเมียม</p></section><HistoryDetails compact /></div>;
}
function PetDetails({ member }: { member: Member }) { return <div className="member-detail-body pet-detail-list">{member.petNames.map((pet, index) => <article key={pet}><span>{index % 2 ? "🐶" : "🐱"}</span><div><h3>{pet}</h3><p>{index % 2 ? "Chihuahua • เพศเมีย" : "Scottish Fold • เพศผู้"}</p><small><CalendarDays /> เกิด 12 มี.ค. 2564</small><em className={index ? "healthy" : "warning"}>{index ? "สุขภาพแข็งแรง" : "แพ้อาหารทะเล"}</em></div></article>)}</div>; }
function HistoryDetails({ compact = false }: { compact?: boolean }) { const entries = [["8 ต.ค. 2567", "รับบริการอาบน้ำ", "฿450", "+50 แต้ม"], ["21 ก.ย. 2567", "ซื้อ Royal Canin Indoor 2kg", "฿1,250", "+120 แต้ม"], ["12 ส.ค. 2567", "รับบริการตัดเล็บ", "฿300", "+30 แต้ม"]]; return <section className={`detail-section history-detail${compact ? " compact" : ""}`}><div className="detail-title"><h3>ประวัติล่าสุด</h3><button type="button">ดูทั้งหมด ›</button></div>{entries.map((entry) => <p key={entry[0]}><i /><small>{entry[0]}</small><span>{entry[1]}</span><b>{entry[2]}</b><em>{entry[3]}</em></p>)}</section>; }
function NotesDetails({ onSave }: { onSave: () => void }) { return <div className="member-detail-body"><section className="detail-section notes-editor"><h3>โน้ตภายใน</h3><textarea defaultValue="ลูกค้าสั่งอาหารเม็ดสูตรแพ้ง่ายเป็นประจำ ชอบสินค้ากลุ่มอาหารแมวเกรดพรีเมียม" /><button type="button" onClick={onSave}>บันทึกโน้ต</button></section><section className="detail-section note-warning"><AlertTriangle /><span><strong>ข้อมูลสำคัญ</strong><small>น้องโมจิแพ้อาหารทะเล โปรดตรวจสอบส่วนผสมก่อนแนะนำสินค้า</small></span></section></div>; }
function AddMemberModal({ close, submit }: { close: () => void; submit: (form: FormData) => void }) { return <div className="preview-modal member-add-modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title"><button className="preview-backdrop" type="button" onClick={close} aria-label="ปิด" /><form action={submit}><button className="preview-close" type="button" onClick={close}><X /></button><h2 id="add-member-title">เพิ่มสมาชิกใหม่</h2><p>กรอกข้อมูลหลักก่อน สามารถเพิ่มรายละเอียดภายหลังได้</p><label>ชื่อ–นามสกุล<input name="name" required placeholder="เช่น คุณมะลิ จันทร์สุข" /></label><label>เบอร์โทรศัพท์<input name="phone" required placeholder="08x-xxx-xxxx" /></label><label>อีเมล<input name="email" type="email" placeholder="name@email.com" /></label><label>ชื่อสัตว์เลี้ยง<input name="pet" placeholder="เช่น น้องโมจิ" /></label><div><button type="button" onClick={close}>ยกเลิก</button><button type="submit"><Plus /> เพิ่มสมาชิก</button></div></form></div>; }
