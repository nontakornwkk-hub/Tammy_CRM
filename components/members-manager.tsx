"use client";

import Image from "next/image";
import { CalendarDays, Check, ChevronRight, Clock3, Crown, Download, Edit3, Heart, LockKeyhole, Mail, Menu, MessageSquareText, PawPrint, Phone, Plus, Search, Sparkles, Star, Tag, UserRound, Users, Wallet, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { MemberRow, MemberTagDefinition } from "@/lib/database.types";
import { createMember } from "@/lib/supabase/members";
import { supabase } from "@/lib/supabase/client";
import { cachedData, clearCachedData, crmOwnerId, crmRole, fetchMembersData, loadCachedData } from "@/lib/supabase/crm-data";
import { Sidebar } from "./sidebar";
import { MemberTagSettings } from "./member-tag-settings";
import { MemberLineTransfer } from "./member-line-transfer";

type Pet = { member_id: string; name: string; species: string; breed: string | null; sex: string | null; birth_date: string | null };
type MembersData = Awaited<ReturnType<typeof fetchMembersData>>;
type LineProfile = { member_id: string; line_display_name: string | null; line_picture_url: string | null; profile_synced_at: string | null };
type LevelFilter = "ทั้งหมด" | MemberRow["level"];
type OverviewFilter = "all" | "new" | "followup" | "birthday";
const ALIAS_KEY = "tammy-member-staff-aliases-v1";
const bangkokDayFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric", month: "numeric", day: "numeric" });
const bangkokMonthFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric", month: "numeric" });
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
function daysUntilBirthday(date: string | null | undefined, todayUtc: number) {
  const match = date?.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  const valid = new Date(Date.UTC(2000, month - 1, day));
  if (valid.getUTCMonth() !== month - 1 || valid.getUTCDate() !== day) return null;
  const currentYear = new Date(todayUtc).getUTCFullYear();
  const anniversary = (year: number) => Date.UTC(year, month - 1, month === 2 && day === 29 && new Date(Date.UTC(year, 1, 29)).getUTCMonth() !== 1 ? 28 : day);
  const next = anniversary(currentYear) >= todayUtc ? anniversary(currentYear) : anniversary(currentYear + 1);
  return Math.floor((next - todayUtc) / 86400000);
}
function escapeCsv(value: string) { return `"${value.replaceAll('"', '""')}"`; }

export function MembersManager() {
  const [members, setMembers] = useState<MemberRow[]>(() => cachedData<MembersData>("members")?.members ?? []);
  const [pets, setPets] = useState<Pet[]>(() => cachedData<MembersData>("members")?.pets ?? []);
  const [tagDefinitions, setTagDefinitions] = useState<MemberTagDefinition[]>(() => cachedData<MembersData>("members")?.tags ?? []);
  const [lineProfiles, setLineProfiles] = useState<Record<string, LineProfile>>({});
  const [aliases, setAliases] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(() => !cachedData<MembersData>("members"));
  const [loadError, setLoadError] = useState("");
  const [demoMode, setDemoMode] = useState(false);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LevelFilter>("ทั้งหมด");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [tagSaving, setTagSaving] = useState(false);
  const [overviewFilter, setOverviewFilter] = useState<OverviewFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingInternal, setEditingInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [purchaseCount, setPurchaseCount] = useState<number | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [tagSettingsOpen, setTagSettingsOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (force = false) => {
    if (!cachedData<MembersData>("members")) setLoading(true);
    setLoadError("");
    if (!supabase) { setMembers(demoMembers); setDemoMode(true); setLoading(false); return; }
    try {
      const ownerId = crmOwnerId();
      if (!ownerId) throw new Error("ยังไม่พบสิทธิ์ของร้าน");
      const result = await loadCachedData(ownerId, "members", () => fetchMembersData(ownerId), force);
      setDemoMode(false); setMembers(result.members); setPets(result.pets); setTagDefinitions(result.tags);
      setLoading(false);
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (token) {
        const response = await fetch("/api/line/messaging/member-profiles", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (response.ok) {
          const data = await response.json() as { profiles: LineProfile[] };
          setLineProfiles(Object.fromEntries(data.profiles.map(profile => [profile.member_id, profile])));
        }
      }
    } catch (error) { setLoadError(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  }, []);
  useEffect(() => { void refresh(); try { const saved = window.localStorage.getItem(ALIAS_KEY); if (saved) setAliases(JSON.parse(saved) as Record<string, string>); } catch { /* Optional local labels. */ } }, [refresh]);

  const todayParts = Object.fromEntries(bangkokDayFormatter.formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const todayUtc = Date.UTC(todayParts.year, todayParts.month - 1, todayParts.day);
  const currentMonth = bangkokMonthFormatter.format(new Date());
  const tagCatalog = useMemo(() => tagDefinitions.map((tag) => tag.name).sort((a, b) => a.localeCompare(b, "th")), [tagDefinitions]);
  const tagColorsByName = useMemo(() => Object.fromEntries(tagDefinitions.map((tag) => [tag.name, tag.color])), [tagDefinitions]);
  const visible = useMemo(() => members.filter((member) => {
    const petNames = pets.filter((pet) => pet.member_id === member.id).map((pet) => pet.name).join(" ");
    const haystack = `${member.name} ${member.member_code} ${member.member_number ?? ""} ${member.phone ?? ""} ${aliases[member.id] ?? ""} ${(member.tags ?? []).join(" ")} ${petNames}`.toLowerCase();
    const matchesOverview = overviewFilter === "all" || (overviewFilter === "new" && Boolean(member.created_at) && Number.isFinite(Date.parse(member.created_at)) && bangkokMonthFormatter.format(new Date(member.created_at)) === currentMonth) || (overviewFilter === "followup" && ["urgent", "lapsed"].includes(followUp(member.last_visit).tone)) || (overviewFilter === "birthday" && (daysUntilBirthday(member.birth_date, todayUtc) ?? Infinity) <= 7);
    return haystack.includes(query.trim().toLowerCase()) && (level === "ทั้งหมด" || member.level === level) && (!tagFilter || (member.tags ?? []).some((tag) => tag.toLocaleLowerCase() === tagFilter.toLocaleLowerCase())) && matchesOverview;
  }).sort((a, b) => (a.member_number ?? Number.MAX_SAFE_INTEGER) - (b.member_number ?? Number.MAX_SAFE_INTEGER) || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)), [members, pets, aliases, query, level, tagFilter, overviewFilter, todayUtc, currentMonth]);
  const followUpCount = members.filter((member) => ["urgent", "lapsed"].includes(followUp(member.last_visit).tone)).length;
  const birthdayCount = members.filter((member) => (daysUntilBirthday(member.birth_date, todayUtc) ?? Infinity) <= 7).length;
  const newThisMonth = members.filter((member) => member.created_at && Number.isFinite(Date.parse(member.created_at)) && bangkokMonthFormatter.format(new Date(member.created_at)) === currentMonth).length;
  function selectOverview(next: OverviewFilter) { setOverviewFilter(next); setQuery(""); setLevel("ทั้งหมด"); setTagFilter(null); }
  const selected = members.find((member) => member.id === selectedId) ?? null;
  const selectedPets = selected ? pets.filter((pet) => pet.member_id === selected.id) : [];
  const dogCount = selectedPets.filter((pet) => pet.species === "dog").length;
  const catCount = selectedPets.filter((pet) => pet.species === "cat").length;

  useEffect(() => {
    if (!selectedId || !supabase || selectedId.startsWith("demo-")) { setPurchaseCount(null); return; }
    let active = true;
    setPurchaseCount(null);
    void supabase.from("points_transactions").select("id", { count: "exact", head: true })
      .eq("member_id", selectedId).eq("owner_id", crmOwnerId() || "").eq("transaction_type", "earn").gt("sale_amount", 0)
      .then(({ count, error }) => { if (active) setPurchaseCount(error ? null : count); });
    return () => { active = false; };
  }, [selectedId]);

  async function saveInternal(form: FormData) {
    if (!selected || !supabase || demoMode) return;
    const nickname = String(form.get("nickname") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();
    setSaving(true);
    const { data, error } = await supabase.from("members").update({ notes }).eq("id", selected.id).select("*").single();
    setSaving(false);
    if (error || !data) { setNotice(`บันทึกไม่สำเร็จ: ${error?.message ?? "ไม่พบสมาชิก"}`); return; }
    const nextAliases = { ...aliases, [selected.id]: nickname };
    setAliases(nextAliases);
    window.localStorage.setItem(ALIAS_KEY, JSON.stringify(nextAliases));
    setMembers((current) => current.map((member) => member.id === selected.id ? data as MemberRow : member));
    clearCachedData("members", "points", "reports");
    setEditingInternal(false); setNotice("บันทึกข้อมูลภายในแล้ว");
  }
  async function saveMemberTags(member: MemberRow, nextTags: string[]) {
    if (!supabase) return false;
    const { data, error } = await supabase.from("members").update({ tags: nextTags }).eq("id", member.id).eq("owner_id", crmOwnerId() || "").select("*").single();
    if (error || !data) { setNotice(`บันทึกแท็กไม่สำเร็จ: ${error?.message ?? "ไม่พบสมาชิก"}`); return false; }
    setMembers((current) => current.map((item) => item.id === member.id ? data as MemberRow : item));
    clearCachedData("members");
    return true;
  }
  async function saveTags(nextTags: string[]) {
    if (!selected || !supabase || demoMode || tagSaving) return;
    setTagSaving(true);
    const saved = await saveMemberTags(selected, nextTags);
    setTagSaving(false);
    if (saved) setNotice("บันทึกแท็กแล้ว");
  }
  async function addTag(rawTag: string) {
    if (!selected || !supabase || tagSaving) return;
    const trimmed = rawTag.trim().replace(/\s+/g, " ");
    if (!trimmed) return;
    if (trimmed.length > 30) { setNotice("ชื่อแท็กยาวได้ไม่เกิน 30 ตัวอักษร"); return; }
    const existing = tagCatalog.find((tag) => tag.toLocaleLowerCase() === trimmed.toLocaleLowerCase());
    const tag = existing ?? trimmed;
    if ((selected.tags ?? []).some((value) => value.toLocaleLowerCase() === tag.toLocaleLowerCase())) return;
    if ((selected.tags ?? []).length >= 8) { setNotice("สมาชิกหนึ่งคนมีแท็กได้ไม่เกิน 8 แท็ก"); return; }
    setTagSaving(true);
    if (!existing) { setTagSaving(false); setNotice("กรุณาสร้างแท็กในหน้าตั้งค่าก่อน"); return; }
    const saved = await saveMemberTags(selected, [...(selected.tags ?? []), tag]);
    setTagSaving(false);
    if (saved) setNotice("เพิ่มแท็กแล้ว");
  }
  async function addMember(form: FormData) {
    const name = String(form.get("name") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    if (!name || !phone) return;
    setSaving(true);
    const result = await createMember({ name, phone, email: String(form.get("email") ?? "").trim() || null });
    setSaving(false);
    if (result.error || !result.data) { setNotice(`เพิ่มสมาชิกไม่สำเร็จ: ${result.error?.message ?? "ไม่พบข้อมูล"}`); return; }
    clearCachedData("members", "points", "reports");
    setAddOpen(false); await refresh(true); setSelectedId(result.data.id); setNotice("เพิ่มสมาชิกแล้ว");
  }
  function exportMembers() {
    const rows = [["รหัสสมาชิก", "ลำดับสมาชิก", "ชื่อ", "ชื่อที่พนักงานจำ", "แท็ก", "โทรศัพท์", "อีเมล", "ระดับ", "แต้ม", "ยอดซื้อสะสม", "มาล่าสุด"], ...[...members].sort((a, b) => (a.member_number ?? Number.MAX_SAFE_INTEGER) - (b.member_number ?? Number.MAX_SAFE_INTEGER) || a.created_at.localeCompare(b.created_at)).map((m) => [m.member_code, String(m.member_number ?? ""), m.name, aliases[m.id] ?? "", (m.tags ?? []).join(" | "), m.phone ?? "", m.email ?? "", m.level, String(m.points), String(m.spending), m.last_visit ?? ""])];
    const csv = "\uFEFF" + rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "tammy-members.csv"; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="app-shell members-page">
    <div className={`mobile-overlay${mobileMenu ? " show" : ""}`} onClick={() => setMobileMenu(false)} />
    <div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/members" onClose={() => setMobileMenu(false)} /></div>
    <main className="main-content">
      <header className="page-header members-header"><button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button><div className="title-icon"><Users /></div><div className="heading-copy"><h1>สมาชิก</h1><p>ข้อมูลสมาชิกและสถานะการติดตาม</p></div><div className="header-actions"><button className="button outline" type="button" onClick={exportMembers} disabled={!members.length || demoMode}><Download size={17} /> ส่งออก</button>{!demoMode ? <button className="button primary" type="button" onClick={() => setAddOpen(true)}><Plus size={18} /> เพิ่มสมาชิก</button> : null}</div></header>
      <div className="member-directory-overview is-interactive" aria-label="ภาพรวมสมาชิกและตัวกรองด่วน">
        <button type="button" className={`member-overview-card is-total${overviewFilter === "all" ? " active" : ""}`} aria-pressed={overviewFilter === "all"} aria-controls="members-list" onClick={() => selectOverview("all")}><span className="member-overview-head"><i><Users size={20} /></i><span>สมาชิกทั้งหมด</span><ChevronRight size={17} /></span><span className="member-overview-value"><strong>{members.length.toLocaleString("th-TH")}</strong><small>คน</small></span><span className="member-overview-foot">รวมสมาชิกทุกระดับ</span></button>
        <button type="button" className={`member-overview-card is-new${overviewFilter === "new" ? " active" : ""}`} aria-pressed={overviewFilter === "new"} aria-controls="members-list" onClick={() => selectOverview("new")}><span className="member-overview-head"><i><Sparkles size={20} /></i><span>สมาชิกใหม่</span><ChevronRight size={17} /></span><span className="member-overview-value"><strong>{newThisMonth.toLocaleString("th-TH")}</strong><small>คน</small></span><span className="member-overview-foot">สมัครในเดือนนี้</span></button>
        <button type="button" className={`member-overview-card is-followup${overviewFilter === "followup" ? " active" : ""}`} aria-pressed={overviewFilter === "followup"} aria-controls="members-list" onClick={() => selectOverview("followup")}><span className="member-overview-head"><i><Heart size={20} /></i><span>ควรติดตาม</span><ChevronRight size={17} /></span><span className="member-overview-value"><strong>{followUpCount.toLocaleString("th-TH")}</strong><small>คน</small></span><span className="member-overview-foot">ไม่ได้มาร้านเกิน 14 วัน</span></button>
        <button type="button" className={`member-overview-card is-birthday${overviewFilter === "birthday" ? " active" : ""}`} aria-pressed={overviewFilter === "birthday"} aria-controls="members-list" onClick={() => selectOverview("birthday")}><span className="member-overview-head"><i><CalendarDays size={20} /></i><span>วันเกิดใกล้ถึง</span><ChevronRight size={17} /></span><span className="member-overview-value"><strong>{birthdayCount.toLocaleString("th-TH")}</strong><small>คน</small></span><span className="member-overview-foot"><Sparkles size={14} /> ภายใน 7 วันข้างหน้า</span></button>
      </div>
      {!demoMode ? <div className="member-tags-admin"><button type="button" className="member-tags-admin-toggle" aria-expanded={tagSettingsOpen} onClick={() => setTagSettingsOpen((open) => !open)}><Tag size={17} /> จัดการแท็ก <span>{tagDefinitions.length} แท็ก</span><ChevronRight size={17} className={tagSettingsOpen ? "open" : ""} /></button>{tagSettingsOpen ? <MemberTagSettings onChanged={() => void refresh(true)} /> : null}</div> : null}
      <section id="members-list" className="panel members-list-panel"><div className="member-tools"><label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อ รหัสสมาชิก เบอร์โทร ชื่อที่จำ หรือแท็ก" /></label><div className="member-level-filter">{(["ทั้งหมด", "Member", "Silver", "Gold", "Platinum"] as const).map((item) => <button key={item} className={`${level === item ? "active " : ""}rank-filter-${item === "ทั้งหมด" ? "all" : item.toLowerCase()}`} type="button" onClick={() => setLevel(item)}>{item}</button>)}</div></div>
        {tagCatalog.length ? <div className="member-tag-filters" aria-label="กรองตามแท็ก"><Tag size={16} /><button type="button" className={!tagFilter ? "active" : ""} onClick={() => setTagFilter(null)}>ทุกแท็ก</button>{tagCatalog.map((tag) => <button key={tag} type="button" className={`${tagFilter === tag ? "active " : ""}tag-color-${tagColorsByName[tag] ?? "sky"}`} onClick={() => setTagFilter(tag)}>{tag}<span>{members.filter((member) => (member.tags ?? []).includes(tag)).length}</span></button>)}</div> : null}
        {loadError ? <div className="members-empty"><strong>{loadError}</strong><button type="button" onClick={() => void refresh()}>ลองอีกครั้ง</button></div> : loading ? <div className="members-empty"><strong>กำลังโหลดข้อมูลสมาชิก…</strong></div> : <>{demoMode ? <div className="member-demo-notice">โหมดตัวอย่าง · ไม่แสดงข้อมูลลูกค้าจริงหรือรหัสจากฐานข้อมูล</div> : null}<div className="members-table"><div className="members-table-head"><span>ลูกค้า</span><span>ชื่อที่พนักงานจำ</span><span>ระดับ</span><span>แต้ม</span><span>ยอดซื้อสะสม</span><span>มาล่าสุด</span><span>การติดตาม</span></div>{visible.map((member) => { const follow = followUp(member.last_visit); const profile = lineProfiles[member.id]; return <button className="members-table-row" type="button" key={member.id} onClick={() => { setSelectedId(member.id); setEditingInternal(false); }} aria-label={`ดูข้อมูล ${member.name}`}><span className="member-identity"><i>{profile?.line_picture_url?.startsWith("https://") ? <img src={profile.line_picture_url} alt="" referrerPolicy="no-referrer" /> : <Image src="/assets/tammy-member-entry-logo.png" alt="" width={44} height={44} />}</i><span><span className="member-name-line"><b>{member.name}</b>{(member.tags ?? []).length > 0 ? <Tag size={13} className="member-has-tags" aria-label="มีแท็ก" /> : null}</span><small>{member.member_code} · ลำดับที่ {member.member_number ?? "—"}</small><small>{member.phone || "ไม่มีเบอร์"}</small></span></span><span className="member-nickname">{aliases[member.id] || "—"}</span><span className={`member-badge ${member.level.toLowerCase()}`}>{member.level}</span><strong>{member.points.toLocaleString()}</strong><strong>฿{Number(member.spending).toLocaleString()}</strong><span>{displayDate(member.last_visit)}</span><span className={`follow-pill ${follow.tone}`}><i />{follow.label}</span></button>; })}</div>{visible.length === 0 ? <div className="members-empty"><Search /><strong>ไม่พบสมาชิก</strong><span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span></div> : null}<footer className="members-footer">แสดง {visible.length} จาก {members.length} รายการ · เรียงตามลำดับสมัคร</footer></>}
      </section>
      {selected ? <div className="preview-modal member-profile-modal" role="dialog" aria-modal="true" aria-label={`ข้อมูลสมาชิก ${selected.name}`}>
        <button className="preview-backdrop" type="button" aria-label="ปิดรายละเอียด" onClick={() => setSelectedId(null)} />
        <section className="member-profile member-profile-reference">
          <button className="member-profile-close" type="button" aria-label="ปิดรายละเอียด" onClick={() => setSelectedId(null)}><X /></button>
          <header className="member-reference-hero">
            <span className="member-reference-avatar">{lineProfiles[selected.id]?.line_picture_url?.startsWith("https://") ? <img src={lineProfiles[selected.id].line_picture_url!} alt={`รูปโปรไฟล์ LINE ของ ${selected.name}`} referrerPolicy="no-referrer" /> : <Image src="/assets/tammy-member-entry-logo.png" alt="" width={140} height={140} />}</span>
            <div className="member-reference-identity">
              <h2>{selected.name}</h2>
              <p><UserRound size={17} /> ชื่อเรียก (ภายใน) <strong>{aliases[selected.id] || "ยังไม่ได้ระบุ"}</strong> <span className={`follow-pill ${followUp(selected.last_visit).tone}`}><i />{followUp(selected.last_visit).label}</span></p>
              <div className="member-reference-meta"><div className="member-code-badge"><span>รหัสสมาชิก</span><strong>{selected.member_code}</strong></div><div className="member-code-badge"><span>ลำดับสมัคร</span><strong>{selected.member_number?.toLocaleString("th-TH") ?? "—"}</strong></div><div className="member-last-visit"><Clock3 size={17} /><span>มาล่าสุด</span><strong>{displayDate(selected.last_visit)}</strong></div></div>
            </div>
            {selected.notes ? <aside className="member-reference-quote">{selected.notes}</aside> : null}
          </header>
          <div className="member-profile-stats">
            <article><Crown /><small>ระดับสมาชิก</small><strong>{selected.level}</strong><span>สถานะสมาชิกปัจจุบัน</span></article>
            <article><Star /><small>คะแนนสะสม</small><strong>{selected.points.toLocaleString()} แต้ม</strong><span>แต้มที่มีในบัญชี</span></article>
            <article><Wallet /><small>ยอดใช้จ่ายรวม</small><strong>฿{Number(selected.spending).toLocaleString()}</strong><span>ตั้งแต่ {displayDate(selected.created_at?.slice(0, 10) || null)}</span></article>
            <article><Wallet /><small>ยอดเฉลี่ยต่อครั้ง</small><strong>{purchaseCount && Number(selected.spending) > 0 ? `฿${(Number(selected.spending) / purchaseCount).toLocaleString("th-TH", { maximumFractionDigits: 0 })}` : "—"}</strong><span>{purchaseCount ? `จาก ${purchaseCount.toLocaleString()} ครั้งที่บันทึกยอดซื้อ` : "ยังไม่มีรายการซื้อที่บันทึกไว้"}</span></article>
          </div>
          <section className="member-profile-section member-profile-readonly">
            <div className="member-section-heading"><div><h3><Users size={21} /> ข้อมูลที่ลูกค้าระบุ</h3><p>ข้อมูลนี้มาจากการสมัครสมาชิก ไม่สามารถแก้ไขได้</p></div></div>
            <div className="member-profile-readonly-list">
              <div><span><UserRound size={18} /> ชื่อ–นามสกุล</span><strong>{selected.name}</strong><LockKeyhole size={16} /></div>
              <div><span><Phone size={18} /> เบอร์โทรศัพท์</span><strong>{selected.phone || "ไม่ได้ระบุ"}</strong><LockKeyhole size={16} /></div>
              <div><span><Mail size={18} /> อีเมล</span><strong>{selected.email || "ไม่ได้ระบุ"}</strong><LockKeyhole size={16} /></div>
              <div><span><LockKeyhole size={18} /> วันเกิด</span><strong>{selected.birth_date ? displayDate(selected.birth_date) : "ยังไม่ได้ระบุ · รอลูกค้าแจ้งข้อมูล"}</strong><LockKeyhole size={16} /></div>
              <div><span><MessageSquareText size={18} /> บัญชี LINE</span><strong>{lineProfiles[selected.id] ? `เชื่อมแล้ว · ${lineProfiles[selected.id].line_display_name || "ลูกค้า LINE"}` : "ยังไม่เชื่อม"}</strong><LockKeyhole size={16} /></div>
            </div>
            {!demoMode && crmRole() !== "staff" ? <MemberLineTransfer memberId={selected.id} memberName={selected.name} oldLineName={lineProfiles[selected.id]?.line_display_name || null} onComplete={() => void refresh(true)} /> : null}
          </section>
          <section className="member-profile-section member-profile-internal">
            <div className="member-section-heading"><div><h3><UserRound size={21} /> ข้อมูลสำหรับพนักงาน</h3><p>ใช้เฉพาะภายในร้านเท่านั้น</p></div>{!editingInternal && !demoMode ? <button type="button" onClick={() => setEditingInternal(true)}><Edit3 size={16} /> แก้ไขข้อมูลภายใน</button> : null}</div>
            {editingInternal ? <form className="member-profile-form" action={saveInternal}><div className="member-profile-fields"><label>ชื่อที่พนักงานจำ<input name="nickname" defaultValue={aliases[selected.id] || ""} placeholder="เช่น แม่โมจิ" /></label><label className="wide">บันทึกเพิ่มเติม<textarea name="notes" defaultValue={selected.notes} rows={3} /></label></div><div className="member-profile-form-actions"><button type="button" onClick={() => setEditingInternal(false)}>ยกเลิก</button><button type="submit" disabled={saving}><Check size={18} /> {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}</button></div></form> : <div className="member-profile-readonly-list internal-list"><div><span><UserRound size={18} /> ชื่อเรียก (ภายใน)</span><strong>{aliases[selected.id] || "ยังไม่ได้ระบุ"}</strong></div><div><span><MessageSquareText size={18} /> บันทึกเพิ่มเติม</span><strong>{selected.notes || "ยังไม่มีบันทึก"}</strong></div></div>}
          </section>
          <section className="member-profile-section member-profile-tags">
            <div className="member-section-heading"><div><h3><Tag size={21} /> แท็กจัดหมวดหมู่</h3><p>ติดแท็กเพื่อค้นหาและกรองลูกค้าในหน้าสมาชิก</p></div></div>
            <div className="member-profile-tag-list">{(selected.tags ?? []).length ? selected.tags.map((tag) => <span className={`member-profile-tag tag-color-${tagColorsByName[tag] ?? "sky"}`} key={tag}>{tag}{!demoMode ? <button type="button" disabled={tagSaving} aria-label={`เอาแท็ก ${tag} ออกจากสมาชิกคนนี้`} title="เอาออกจากสมาชิกคนนี้" onClick={() => void saveTags((selected.tags ?? []).filter((value) => value !== tag))}><X size={13} /></button> : null}</span>) : <span className="member-tag-empty">ยังไม่ได้ติดแท็ก</span>}</div>
            {!demoMode ? <>
              {tagCatalog.some((tag) => !(selected.tags ?? []).some((value) => value.toLocaleLowerCase() === tag.toLocaleLowerCase())) ? <div className="member-tag-suggestions"><small>แท็กที่มีอยู่ · แตะเพื่อเพิ่ม</small><div>{tagCatalog.filter((tag) => !(selected.tags ?? []).some((value) => value.toLocaleLowerCase() === tag.toLocaleLowerCase())).map((tag) => <button className={`tag-color-${tagColorsByName[tag] ?? "sky"}`} key={tag} type="button" disabled={tagSaving} onClick={() => void addTag(tag)}><Plus size={13} /> {tag}</button>)}</div></div> : null}
            </> : null}
          </section>
          <section className="member-profile-section member-profile-pet-section">
            <div className="member-section-heading"><div><h3><PawPrint size={22} /> สัตว์เลี้ยง</h3><p>จำนวนสัตว์เลี้ยงของสมาชิก</p></div></div>
            <div className="member-pet-counts"><div><span aria-hidden="true">🐶</span><strong>สุนัข</strong><b>{dogCount} ตัว</b></div><div><span aria-hidden="true">🐱</span><strong>แมว</strong><b>{catCount} ตัว</b></div></div>
          </section>
          <footer className="member-reference-footer"><Heart size={17} fill="currentColor" /> ขอบคุณที่เป็นส่วนหนึ่งของครอบครัว Tammy <Heart size={17} /></footer>
        </section>
      </div> : null}
      {addOpen ? <div className="preview-modal member-add-modal" role="dialog" aria-modal="true" aria-labelledby="add-member-title"><button className="preview-backdrop" type="button" aria-label="ปิด" onClick={() => setAddOpen(false)} /><form action={addMember}><button className="preview-close" type="button" aria-label="ปิด" onClick={() => setAddOpen(false)}><X /></button><h2 id="add-member-title">เพิ่มสมาชิกใหม่</h2><p>ระบบจะสร้างรหัสสมาชิกและบันทึกลงฐานข้อมูล</p><label>ชื่อ–นามสกุล<input name="name" required /></label><label>เบอร์โทรศัพท์<input name="phone" required /></label><label>อีเมล<input name="email" type="email" /></label><div><button type="button" onClick={() => setAddOpen(false)}>ยกเลิก</button><button type="submit" disabled={saving}><Plus size={18} /> {saving ? "กำลังบันทึก…" : "เพิ่มสมาชิก"}</button></div></form></div> : null}
      {notice ? <div className="member-toast" role="status" onAnimationEnd={() => setNotice("")}><Check size={18} /> {notice}</div> : null}
    </main>
  </div>;
}
