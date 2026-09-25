"use client";

import Image from "next/image";
import { Check, Crown, Download, Edit3, Heart, LockKeyhole, Mail, Menu, MessageSquareText, PawPrint, Phone, Plus, Search, Star, UserRound, Users, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MemberRow } from "@/lib/database.types";
import { createMember } from "@/lib/supabase/members";
import { supabase } from "@/lib/supabase/client";
import { Sidebar } from "./sidebar";
import { DateRangePicker } from "./date-range-picker";

type Pet = { member_id: string; name: string; species: string; breed: string | null; sex: string | null; birth_date: string | null };
type LevelFilter = "ทั้งหมด" | MemberRow["level"];
const ALIAS_KEY = "tammy-member-staff-aliases-v1";
const demoMembers: MemberRow[] = [
  { id: "demo-1", owner_id: "", member_code: "DEMO-001", name: "ลูกค้าตัวอย่าง 1", phone: "08x-xxx-xxxx", email: null, level: "Gold", points: 120, spending: 2400, last_visit: null, status: "active", newsletter_opt_in: false, notes: "", tags: [], created_at: "", updated_at: "" },
  { id: "demo-2", owner_id: "", member_code: "DEMO-002", name: "ลูกค้าตัวอย่าง 2", phone: "08x-xxx-xxxx", email: null, level: "Member", points: 0, spending: 0, last_visit: null, status: "active", newsletter_opt_in: false, notes: "", tags: [], created_at: "", updated_at: "" },
];

function daysSince(date: string | null) {
  if (!date) return null;
  const parts = date.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const bangkok = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date());
  const today = Object.fromEntries(bangkok.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return Math.max(0, Math.floor((Date.UTC(today.year, today.month - 1, today.day) - Date.UTC(parts[0], parts[1] - 1, parts[2])) / 86400000));
}
function followUp(date: string | null) {
  const days = daysSince(date);
  if (days === null) return { tone: "unknown", label: "ยังไม่เคยมา" };
  if (days <= 3) return { tone: "recent", label: days === 0 ? "เพิ่งมาวันนี้" : `เพิ่งมา · ${days} วัน` };
  if (days <= 7) return { tone: "steady", label: `${days} วันที่แล้ว` };
  if (days <= 14) return { tone: "watch", label: `เริ่มติดตาม · ${days} วัน` };
  if (days <= 30) return { tone: "urgent", label: `ควรติดตาม · ${days} วัน` };
  return { tone: "lapsed", label: `หายไปเกินเดือน · ${days} วัน` };
}
function displayDate(date: string | null) {
  return date ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00+07:00`)) : "ยังไม่มีประวัติการมา";
}
function petAge(date: string | null) {
  if (!date) return "";
  const months = Math.max(0, Math.floor((Date.now() - new Date(`${date}T12:00:00+07:00`).getTime()) / 2629800000));
  return `อายุ ${Math.floor(months / 12)} ปี ${months % 12} เดือน`;
}
function escapeCsv(value: string) { return `"${value.replaceAll('"', '""')}"`; }

export function MembersManager() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("ทั้งหมด");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingInternal, setEditingInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addBirthDate, setAddBirthDate] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setLoadError("");
    if (!supabase) { setMembers(demoMembers); setDemoMode(true); setLoading(false); return; }
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { setMembers(demoMembers); setPets([]); setDemoMode(true); setLoading(false); return; }
    setDemoMode(false);
    const [memberResult, petResult] = await Promise.all([
      supabase.from("members").select("*").order("member_code"),
      supabase.from("pets").select("member_id,name,species,breed,sex,birth_date").order("created_at"),
    ]);
    if (memberResult.error || petResult.error) setLoadError(memberResult.error?.message || petResult.error?.message || "โหลดข้อมูลไม่สำเร็จ");
    else { setMembers(memberResult.data as MemberRow[]); setPets(petResult.data as Pet[]); }
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); try { const saved = window.localStorage.getItem(ALIAS_KEY); if (saved) setAliases(JSON.parse(saved) as Record<string, string>); } catch { /* Optional local labels. */ } }, [refresh]);

  const visible = useMemo(() => members.filter((member) => {
    const petNames = pets.filter((pet) => pet.member_id === member.id).map((pet) => pet.name).join(" ");
    const haystack = `${member.name} ${member.member_code} ${member.phone ?? ""} ${aliases[member.id] ?? ""} ${petNames}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase()) && (level === "ทั้งหมด" || member.level === level);
  }), [members, pets, aliases, query, level]);
  const selected = members.find((member) => member.id === selectedId) ?? null;
  const selectedPets = selected ? pets.filter((pet) => pet.member_id === selected.id) : [];

  async function saveInternal(form: FormData) {
    if (!selected || !supabase || demoMode) return;
    const nickname = String(form.get("nickname") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    const birthDate = String(form.get("birth_date") ?? "").trim() || null;
    setSaving(true);
    const { data, error } = await supabase.from("members").update({ notes, birth_date: birthDate }).eq("id", selected.id).select("*").single();
    setSaving(false);
    if (error || !data) { setNotice(`บันทึกไม่สำเร็จ: ${error?.message ?? "ไม่พบสมาชิก"}`); return; }
    const nextAliases = { ...aliases, [selected.id]: nickname };
    setAliases(nextAliases);
    window.localStorage.setItem(ALIAS_KEY, JSON.stringify(nextAliases));
    setMembers((current) => current.map((member) => member.id === selected.id ? data as MemberRow : member));
    setEditingInternal(false); setNotice("บันทึกข้อมูลภายในแล้ว");
  }
  async function addMember(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    if (!name || !phone) return;
    setSaving(true);
    const result = await createMember({ name, phone, email: String(form.get("email") ?? "").trim() || null, birthDate: String(form.get("birth_date") ?? "").trim() || null });
    setSaving(false);
    if (result.error || !result.data) { setNotice(`เพิ่มสมาชิกไม่สำเร็จ: ${result.error?.message ?? "ไม่พบข้อมูล"}`); return; }
    setAddOpen(false); setAddBirthDate(""); await refresh(); setSelectedId(result.data.id); setNotice("เพิ่มสมาชิกแล้ว");
  }
  function exportMembers() {
    const rows = [["รหัสสมาชิก", "ชื่อ", "ชื่อที่พนักงานจำ", "โทรศัพท์", "อีเมล", "ระดับ", "แต้ม", "ยอดซื้อสะสม", "มาล่าสุด"], ...members.map((m) => [m.member_code, m.name, aliases[m.id] ?? "", m.phone ?? "", m.email ?? "", m.level, String(m.points), String(m.spending), m.last_visit ?? ""])];
    const csv = "\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "tammy-members.csv"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="app-shell members-page">
    <div className={`mobile-overlay${mobileMenu ? " show" : ""}`} onClick={() => setMobileMenu(false)} />
    <div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/members" /></div>
    <main className="main-content">
      <header className="page-header members-header"><button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button><div className="title-icon"><Users /></div><div className="heading-copy"><h1>สมาชิก</h1><p>ข้อมูลสมาชิกและสถานะการติดตาม</p></div><div className="header-actions"><button className="button outline" type="button" onClick={exportMembers} disabled={!members.length || demoMode}><Download size={17} /> ส่งออก</button>{!demoMode ? <button className="button primary" type="button" onClick={() => { setAddBirthDate(""); setAddOpen(true); }}><Plus size={18} /> เพิ่มสมาชิก</button> : null}</div></header>
      <div className="member-directory-overview" aria-label="ภาพรวมสมาชิก"><div><span>สมาชิกทั้งหมด</span><strong>{members.length.toLocaleString()} <small>คน</small></strong></div><div><span>มีชื่อที่พนักงานจำ</span><strong>{members.filter((member) => Boolean(aliases[member.id]?.trim())).length.toLocaleString()} <small>คน</small></strong></div><div><span>ควรติดตาม</span><strong>{members.filter((member) => ["urgent", "lapsed"].includes(followUp(member.last_visit).tone)).length.toLocaleString()} <small>คน</small></strong></div></div>
      <section className="panel members-list-panel"><div className="member-tools"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ รหัสสมาชิก เบอร์โทร หรือชื่อที่พนักงานจำ" /></label><div className="member-level-filter">{(["ทั้งหมด", "Gold", "Silver", "Member"] as const).map((item) => <button key={item} className={level === item ? "active" : ""} type="button" onClick={() => setLevel(item)}>{item}</button>)}</div></div>
        {loadError ? <div className="members-empty"><strong>{loadError}</strong><button type="button" onClick={() => void refresh()}>ลองอีกครั้ง</button></div> : loading ? <div className="members-empty"><strong>กำลังโหลดข้อมูลสมาชิก…</strong></div> : <>{demoMode ? <div className="member-demo-notice">โหมดตัวอย่าง · ไม่แสดงข้อมูลลูกค้าจริงหรือรหัสจากฐานข้อมูล</div> : null}<div className="members-table"><div className="members-table-head"><span>ลูกค้า</span><span>ชื่อที่พนักงานจำ</span><span>ระดับ</span><span>แต้ม</span><span>ยอดซื้อสะสม</span><span>มาล่าสุด</span><span>การติดตาม</span></div>{visible.map((member) => { const follow = followUp(member.last_visit); return <button className="members-table-row" type="button" key={member.id} onClick={() => { setSelectedId(member.id); setEditingInternal(false); }} aria-label={`ดูข้อมูล ${member.name}`}><span className="member-identity"><i><Image src="/assets/tammy-logo-cat.png" alt="" width={44} height={44} /></i><span><b>{member.name}</b><small>{member.member_code} · {member.phone || "ไม่มีเบอร์"}</small></span></span><span className="member-nickname">{aliases[member.id] || "—"}</span><span className={`member-badge ${member.level.toLowerCase()}`}>{member.level}</span><strong>{member.points.toLocaleString()}</strong><strong>฿{Number(member.spending).toLocaleString()}</strong><span>{displayDate(member.last_visit)}</span><span className={`follow-pill ${follow.tone}`}><i />{follow.label}</span></button>; })}</div>{visible.length === 0 ? <div className="members-empty"><Search /><strong>ไม่พบสมาชิก</strong><span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span></div> : null}<footer className="members-footer">แสดง {visible.length} จาก {members.length} รายการ</footer></>}
      </section>
      {selected ? <div className="preview-modal member-profile-modal" role="dialog" aria-modal="true" aria-label={`ข้อมูลสมาชิก ${selected.name}`}>
        <button className="preview-backdrop" type="button" aria-label="ปิดรายละเอียด" onClick={() => setSelectedId(null)} />
        <section className="member-profile member-profile-reference">
          <button className="member-profile-close" type="button" aria-label="ปิดรายละเอียด" onClick={() => setSelectedId(null)}><X /></button>
          <header className="member-reference-hero">
            <span className="member-reference-avatar"><Image src="/assets/tammy-logo-cat.png" alt="" width={140} height={140} /></span>
            <div className="member-reference-identity">
              <h2>{selected.name}</h2>
              <p><UserRound size={17} /> ชื่อเรียก (ภายใน) <strong>{aliases[selected.id] || "ยังไม่ได้ระบุ"}</strong> <span className={`follow-pill ${followUp(selected.last_visit).tone}`}><i />{followUp(selected.last_visit).label}</span></p>
              <small>รหัสสมาชิก {selected.member_code} · มาล่าสุด {displayDate(selected.last_visit)}</small>
            </div>
            {selected.notes ? <aside className="member-reference-quote">{selected.notes}</aside> : null}
          </header>
          <div className="member-profile-stats">
            <article><Crown /><small>ระดับสมาชิก</small><strong>{selected.level}</strong><span>สถานะสมาชิกปัจจุบัน</span></article>
            <article><Star /><small>คะแนนสะสม</small><strong>{selected.points.toLocaleString()} แต้ม</strong><span>แต้มที่มีในบัญชี</span></article>
            <article><Wallet /><small>ยอดใช้จ่ายรวม</small><strong>฿{Number(selected.spending).toLocaleString()}</strong><span>ตั้งแต่ {displayDate(selected.created_at?.slice(0, 10) || null)}</span></article>
          </div>
          <section className="member-profile-section member-profile-readonly">
            <div className="member-section-heading"><div><h3><Users size={21} /> ข้อมูลที่ลูกค้าระบุ</h3><p>ข้อมูลนี้มาจากการสมัครสมาชิก ไม่สามารถแก้ไขได้</p></div></div>
            <div className="member-profile-readonly-list">
              <div><span><UserRound size={18} /> ชื่อ–นามสกุล</span><strong>{selected.name}</strong><LockKeyhole size={16} /></div>
              <div><span><Phone size={18} /> เบอร์โทรศัพท์</span><strong>{selected.phone || "ไม่ได้ระบุ"}</strong><LockKeyhole size={16} /></div>
              <div><span><Mail size={18} /> อีเมล</span><strong>{selected.email || "ไม่ได้ระบุ"}</strong><LockKeyhole size={16} /></div>
            </div>
          </section>
          <section className="member-profile-section member-profile-internal">
            <div className="member-section-heading"><div><h3><UserRound size={21} /> ข้อมูลสำหรับพนักงาน</h3><p>ใช้เฉพาะภายในร้านเท่านั้น</p></div>{!editingInternal && !demoMode ? <button type="button" onClick={() => { setEditBirthDate(selected.birth_date || ""); setEditingInternal(true); }}><Edit3 size={16} /> แก้ไขข้อมูลภายใน</button> : null}</div>
            {editingInternal ? <form className="member-profile-form" action={saveInternal}><div className="member-profile-fields"><label>ชื่อที่พนักงานจำ<input name="nickname" defaultValue={aliases[selected.id] || ""} placeholder="เช่น แม่โมจิ" /></label><label>วันเกิดลูกค้า (ถ้าทราบ)<DateRangePicker single start={editBirthDate} end="" onChange={setEditBirthDate} nameStart="birth_date" label="วันเกิดลูกค้า" /></label><label className="wide">บันทึกเพิ่มเติม<textarea name="notes" defaultValue={selected.notes} rows={3} /></label></div><div className="member-profile-form-actions"><button type="button" onClick={() => setEditingInternal(false)}>ยกเลิก</button><button type="submit" disabled={saving}><Check size={18} /> {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</button></div></form> : <div className="member-profile-readonly-list internal-list"><div><span><UserRound size={18} /> ชื่อเรียก (ภายใน)</span><strong>{aliases[selected.id] || "ยังไม่ได้ระบุ"}</strong></div><div><span>วันเกิด</span><strong>{selected.birth_date ? displayDate(selected.birth_date) : "ยังไม่ได้ระบุ"}</strong></div><div><span><MessageSquareText size={18} /> บันทึกเพิ่มเติม</span><strong>{selected.notes || "ยังไม่มีบันทึก"}</strong></div></div>}
          </section>
          <section className="member-profile-section member-profile-pet-section">
            <div className="member-section-heading"><div><h3><PawPrint size={22} /> สัตว์เลี้ยงของ{aliases[selected.id] || selected.name} <small>({selectedPets.length} ตัว)</small></h3></div></div>
            <div className="member-profile-pets">{selectedPets.length ? selectedPets.map((pet, index) => <article key={`${pet.name}-${index}`}><span className="pet-reference-avatar">{pet.species === "dog" ? "🐶" : pet.species === "cat" ? "🐱" : "🐾"}</span><div><strong>{pet.name}</strong><small>{pet.species === "cat" ? "แมว" : pet.species === "dog" ? "สุนัข" : "สัตว์เลี้ยง"}{pet.breed ? ` · ${pet.breed}` : ""}</small>{petAge(pet.birth_date) ? <small>{petAge(pet.birth_date)}</small> : null}</div><span className="pet-reference-sex">{pet.sex === "female" ? "♀" : pet.sex === "male" ? "♂" : ""}</span></article>) : <p>ยังไม่มีข้อมูลสัตว์เลี้ยง</p>}</div>
          </section>
          <footer className="member-reference-footer"><Heart size={17} fill="currentColor" /> ขอบคุณที่เป็นส่วนหนึ่งของครอบครัว Tammy <Heart size={17} /></footer>
        </section>
      </div> : null}
      {addOpen ? <div className="preview-modal member-add-modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title"><button className="preview-backdrop" type="button" aria-label="ปิด" onClick={() => setAddOpen(false)} /><form action={addMember}><button className="preview-close" type="button" aria-label="ปิด" onClick={() => setAddOpen(false)}><X /></button><h2 id="add-member-title">เพิ่มสมาชิกใหม่</h2><p>ระบบจะสร้างรหัสสมาชิกและบันทึกลงฐานข้อมูล</p><label>ชื่อ–นามสกุล<input name="name" required /></label><label>เบอร์โทรศัพท์<input name="phone" required /></label><label>อีเมล<input name="email" type="email" /></label><label>วันเกิด (ไม่บังคับ · สำหรับโปรเดือนเกิด)<DateRangePicker single start={addBirthDate} end="" onChange={setAddBirthDate} nameStart="birth_date" label="วันเกิดสมาชิก" /></label><div><button type="button" onClick={() => setAddOpen(false)}>ยกเลิก</button><button type="submit" disabled={saving}><Plus size={18} /> {saving ? "กำลังบันทึก…" : "เพิ่มสมาชิก"}</button></div></form></div> : null}
      {notice ? <div className="member-toast" role="status" onAnimationEnd={() => setNotice("")}><Check size={18} /> {notice}</div> : null}
    </main>
  </div>;
}
