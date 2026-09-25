"use client";

import Image from "next/image";
import Link from "next/link";
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
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { defaultSettings, loadSettings } from "@/lib/settings";
import { calculateAward } from "@/lib/promotions";
import { supabase } from "@/lib/supabase/client";
import { Sidebar } from "./sidebar";
import { PromotionDisplay } from "./promotion-display";

type MemberLevel = "Platinum" | "Gold" | "Silver" | "Member";
type Customer = {
  id: string;
  name: string;
  nickname: string;
  phone: string;
  level: MemberLevel;
  points: number;
  spending: number;
  birthDate: string;
  createdAt: string;
  pinned: boolean;
};

const levelClass: Record<MemberLevel, string> = { Platinum: "platinum", Gold: "gold", Silver: "silver", Member: "member" };
type PointTransaction = { id: string; created_at: string; member_id: string; sale_amount: number; points_delta: number; transaction_type: string; note: string };
const ALIAS_KEY = "tammy-member-staff-aliases-v1";

function loadMemberAliases(): Record<string, string> {
  try {
    const saved = window.localStorage.getItem(ALIAS_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

export function PointsManager() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [birthdayClaims, setBirthdayClaims] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ทั้งหมด" | "ปักหมุด" | "ใช้งานล่าสุด">("ทั้งหมด");
  const [saleInput, setSaleInput] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState({ earned: 0, total: 0 });
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [systemSettings, setSystemSettings] = useState(defaultSettings);
  const selected = customers.find((customer) => customer.id === selectedId) ?? customers[0] ?? { id: "", name: "ยังไม่ได้เลือกลูกค้า", nickname: "", phone: "-", level: "Member" as const, points: 0, spending: 0, birthDate: "", createdAt: "", pinned: false };
  const sale = Number(saleInput) || 0;
  const pointRate = selected.level === "Platinum" ? systemSettings.platinumBahtPerPoint : selected.level === "Gold" ? systemSettings.goldBahtPerPoint : systemSettings.pointsSpend;
  const pointUnit = selected.level === "Gold" || selected.level === "Platinum" ? 1 : systemSettings.pointsEarned;
  const award = calculateAward(sale, pointRate, pointUnit, systemSettings.promotions, undefined, selected.createdAt, selected.birthDate, birthdayClaims.has(selected.id));
  const upgradeBonus = selected.level === "Platinum" ? 0 : selected.level === "Gold" ? (selected.spending + sale >= systemSettings.platinumMinSpend ? systemSettings.platinumUpgradeBonus : 0) : (selected.spending + sale >= systemSettings.goldMinSpend ? systemSettings.goldUpgradeBonus : 0) + (selected.spending + sale >= systemSettings.platinumMinSpend ? systemSettings.platinumUpgradeBonus : 0);
  const earned = systemSettings.accumulationEnabled ? award.total + upgradeBonus : 0;

  useEffect(() => {
    setSystemSettings(loadSettings());
    const update = () => setSystemSettings(loadSettings());
    window.addEventListener("tammy-settings-changed", update);
    return () => window.removeEventListener("tammy-settings-changed", update);
  }, []);

  useEffect(() => { void (async () => {
    if (!supabase) { setError("ยังไม่ได้ตั้งค่า Supabase"); setLoading(false); return; }
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) { setError("กรุณาเข้าสู่ระบบก่อนให้แต้ม"); setLoading(false); return; }
    const [membersResult, transactionsResult, settingsResult, birthdayResult] = await Promise.all([
      supabase.from("members").select("id,name,phone,level,points,spending,birth_date,created_at").order("member_code"),
      supabase.from("points_transactions").select("id,created_at,member_id,sale_amount,points_delta,transaction_type,note").order("created_at", { ascending: false }).limit(100),
      supabase.from("store_settings").select("extra,points_spend,points_earned").eq("owner_id", auth.user.id).maybeSingle(),
      supabase.from("points_transactions").select("member_id,birthday_bonus_year").eq("birthday_bonus_year", Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()))),
    ]);
    const extra = settingsResult.data?.extra && typeof settingsResult.data.extra === "object" ? settingsResult.data.extra as Record<string, unknown> : null;
    if (extra?.points_policy_version === 1) setSystemSettings((current) => ({
      ...current,
      pointsSpend: Number(settingsResult.data?.points_spend) || current.pointsSpend,
      pointsEarned: Number(settingsResult.data?.points_earned) || current.pointsEarned,
      goldMinSpend: Number(extra.gold_min_spend) || current.goldMinSpend,
      platinumMinSpend: Number(extra.platinum_min_spend) || current.platinumMinSpend,
      goldBahtPerPoint: Number(extra.gold_baht_per_point) || current.goldBahtPerPoint,
      platinumBahtPerPoint: Number(extra.platinum_baht_per_point) || current.platinumBahtPerPoint,
      goldUpgradeBonus: Number.isInteger(extra.gold_upgrade_bonus) ? Number(extra.gold_upgrade_bonus) : current.goldUpgradeBonus,
      platinumUpgradeBonus: Number.isInteger(extra.platinum_upgrade_bonus) ? Number(extra.platinum_upgrade_bonus) : current.platinumUpgradeBonus,
      promotions: Array.isArray(extra.promotions) ? extra.promotions as typeof current.promotions : current.promotions,
      accumulationEnabled: typeof extra.accumulation_enabled === "boolean" ? extra.accumulation_enabled : current.accumulationEnabled,
    }));
    if (membersResult.error) {
      setError(`โหลดสมาชิกไม่สำเร็จ: ${membersResult.error.message}`);
    } else {
      const aliases = loadMemberAliases();
      const mapped = (membersResult.data || []).map((m) => ({ id: m.id, name: m.name, nickname: aliases[m.id] || "", phone: m.phone || "-", level: m.level as MemberLevel, points: Number(m.points) || 0, spending: Number(m.spending) || 0, birthDate: m.birth_date || "", createdAt: m.created_at || "", pinned: false }));
      setCustomers(mapped);
      setSelectedId(mapped[0]?.id || "");
    }
    if (transactionsResult.error) setError((current) => current || `โหลดประวัติแต้มไม่สำเร็จ: ${transactionsResult.error.message}`);
    else setTransactions(transactionsResult.data || []);
    if (!birthdayResult.error) setBirthdayClaims(new Set((birthdayResult.data || []).map((row) => row.member_id)));
    setLoading(false);
  })(); }, []);

  const visible = useMemo(() => customers.filter((customer) => {
    const searchMatch = `${customer.name} ${customer.nickname} ${customer.phone}`.toLowerCase().includes(query.trim().toLowerCase());
    const filterMatch = filter === "ทั้งหมด" || filter === "ใช้งานล่าสุด" || customer.pinned;
    return searchMatch && filterMatch;
  }), [customers, filter, query]);

  async function confirmPoints() {
    if (submitting || !supabase || !selected || sale <= 0 || earned <= 0 || !systemSettings.accumulationEnabled) return;
    setSubmitting(true); setError("");
    try {
      const { data, error: awardError } = await supabase.rpc("award_points", { target_member_id: selected.id, sale, earned, memo: "ให้แต้มจากหน้า CRM" });
      if (awardError) throw awardError;
      if (!data?.id) throw new Error("ฐานข้อมูลไม่ยืนยันรายการให้แต้ม");
      const total = Number(data.points);
      const recent = await supabase.from("points_transactions").select("id,created_at,member_id,sale_amount,points_delta,transaction_type,note").order("created_at", { ascending: false }).limit(100);
      if (!recent.error) setTransactions(recent.data || []);
      setCustomers((current) => current.map((customer) => customer.id === selected.id ? { ...customer, points: total, level: data.level as MemberLevel, spending: Number(data.spending) } : customer));
      if (award.promotion?.type === "birthday") setBirthdayClaims((current) => new Set(current).add(selected.id));
      setSuccessReceipt({ earned: total - selected.points, total });
      setConfirmOpen(false); setSuccessOpen(true); setSaleInput("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "บันทึกแต้มไม่สำเร็จ");
    } finally { setSubmitting(false); }
  }

  function togglePin(id: string) {
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
                {loading ? <p className="rewards-gallery-empty">กำลังโหลดสมาชิก...</p> : !customers.length ? <p className="rewards-gallery-empty">ยังไม่มีสมาชิกที่ให้แต้มได้</p> : null}
                {visible.map((customer) => <article key={customer.id} className={`customer-row${selectedId === customer.id ? " selected" : ""}`} role="button" tabIndex={0} aria-pressed={selectedId === customer.id} aria-label={`เลือก ${customer.name}${customer.nickname ? ` ชื่อที่จำ ${customer.nickname}` : ""}`} onClick={() => setSelectedId(customer.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(customer.id); } }}>
                  <span className="customer-identity"><span className="pet-avatar"><Image src="/assets/tammy-logo-cat.png" alt="" width={44} height={44} /></span><span className="customer-name">{customer.name}</span></span>
                  <strong className="customer-alias">{customer.nickname || "—"}</strong>
                  <span>{customer.phone}</span>
                  <span className={`member-badge ${levelClass[customer.level]}`}>{customer.level === "Gold" ? <Crown size={14} /> : <PawPrint size={14} />}{customer.level}</span>
                  <strong>{customer.points.toLocaleString()}</strong>
                  <button type="button" className={`pin-button${customer.pinned ? " active" : ""}`} onClick={(event) => { event.stopPropagation(); togglePin(customer.id); }} aria-label={`ปักหมุด ${customer.name}`}><Pin size={18} /></button>
                  <span className="customer-selection"><span className={`radio${selectedId === customer.id ? " checked" : ""}`}>{selectedId === customer.id ? <Check size={14} /> : null}</span></span>
                </article>)}
              </div>
            </div>
          </section>

          <aside className="points-side">
            <section className="panel points-summary">
              <div className="step-heading"><span>2</span><h2>ให้แต้มและสรุป</h2></div>
              <div className="selected-customer">
                <span className="pet-avatar large"><Image src="/assets/tammy-logo-cat.png" alt="" width={58} height={58} /></span>
                <div><strong>{selected.name}</strong><small>{selected.nickname ? `${selected.nickname} · ` : ""}☎ {selected.phone}</small></div>
                <span className={`member-badge ${levelClass[selected.level]}`}><Crown size={15} />{selected.level}</span>
              </div>
              <div className="sale-input"><label>ยอดซื้อ</label><div><input type="number" min="0" inputMode="decimal" value={saleInput} placeholder="0" onChange={(event) => setSaleInput(event.target.value)} /><span>บาท</span></div><small>ระดับ {selected.level}: ทุก {pointRate} บาท = {pointUnit} แต้ม</small></div>
              {award.promotion ? <PromotionDisplay promotion={award.promotion} index={systemSettings.promotions.findIndex((promotion) => promotion.id === award.promotion?.id)} /> : null}
              <div className="calculation"><p><span>ยอดซื้อ</span><strong>{sale.toLocaleString()} บาท</strong></p><p><span>แต้มตามระดับ (ทุก {pointRate} บาท = {pointUnit} แต้ม)</span><strong>{award.base} แต้ม</strong></p>{award.promotion ? <p><span>โบนัสโปรโมชั่น</span><strong>+{award.bonus} แต้ม</strong></p> : null}{upgradeBonus > 0 ? <p><span>โบนัสเลื่อนระดับ</span><strong>+{upgradeBonus} แต้ม</strong></p> : null}</div>
              <div className="earned"><span><PawPrint /> แต้มที่จะได้รับ</span><strong>+{earned} แต้ม</strong></div>
              <div className="points-before-after"><div><span>แต้มปัจจุบัน</span><strong>{selected.points.toLocaleString()} แต้ม</strong></div><b>→</b><div><span>หลังทำรายการ</span><strong>{(selected.points + earned).toLocaleString()} แต้ม</strong></div></div>
              <p className="check-notice">● ตรวจสอบยอดซื้อก่อนยืนยัน</p>
              {error ? <p className="rewards-gallery-error" role="alert">{error}</p> : null}
              {!systemSettings.accumulationEnabled ? <p className="check-notice">ระบบสะสมแต้มถูกปิดอยู่ — <Link href="/settings">ไปเปิดที่ตั้งค่าระบบ</Link> ก่อนให้แต้ม</p> : sale > 0 && earned === 0 ? <p className="check-notice">ยอดซื้อนี้ยังไม่ถึงเกณฑ์รับแต้ม (ทุก {pointRate} บาท = {pointUnit} แต้ม)</p> : null}
              <button className="confirm-points" type="button" disabled={loading || !selected.id || sale <= 0 || earned <= 0 || !systemSettings.accumulationEnabled} onClick={() => setConfirmOpen(true)}><Gift /> ยืนยันให้แต้ม</button>
            </section>

            <section className="panel recent-points">
              <div className="recent-title"><h3><Clock3 /> รายการล่าสุด</h3><button type="button" onClick={() => setShowAllHistory((current) => !current)}>{showAllHistory ? "แสดงน้อยลง" : "ดูทั้งหมด ›"}</button></div>
              <div className="recent-head"><span>วันที่</span><span>ลูกค้า</span><span>รายการ</span><span>แต้ม</span></div>
              {transactions.length === 0 ? <p className="rewards-gallery-empty">ยังไม่มีรายการแต้ม</p> : transactions.slice(0, showAllHistory ? transactions.length : 3).map((row) => <div className="recent-row" key={row.id}><span>{new Date(row.created_at).toLocaleDateString("th-TH")}</span><span>{customers.find((customer) => customer.id === row.member_id)?.name || "สมาชิก"}</span><span title={row.note}>{row.transaction_type === "earn" ? `${Number(row.sale_amount).toLocaleString()} บาท` : row.note || "ปรับแต้ม"}</span><span className={row.points_delta >= 0 ? "green" : "negative"}>{row.points_delta > 0 ? "+" : ""}{row.points_delta}</span></div>)}
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
              {error ? <p className="rewards-gallery-error" role="alert">บันทึกไม่สำเร็จ: {error}</p> : null}
              <div className="confirm-actions">
                <button type="button" onClick={() => setConfirmOpen(false)}>ยกเลิก</button>
                <button type="button" onClick={confirmPoints} disabled={submitting}>{submitting ? "กำลังบันทึก..." : <><Gift size={18} /> ยืนยันการให้แต้ม</>}</button>
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
