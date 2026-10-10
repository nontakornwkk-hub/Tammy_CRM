"use client";


import { notifyCatalogChanged } from "@/lib/catalog-live";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Crown,
  Gift,
  Menu,
  PawPrint,
  Pin,
  ScanLine,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultSettings, loadSettings } from "@/lib/settings";
import { calculateAward } from "@/lib/promotions";
import { supabase } from "@/lib/supabase/client";
import { cachedData, clearCachedData, crmOwnerId, fetchPointsData, loadCachedData } from "@/lib/supabase/crm-data";
import { cachedLinePictures, rememberLinePictures } from "@/lib/supabase/line-profile-cache";
import { Sidebar } from "./sidebar";
import { TransactionHistory } from "./transaction-history";
import { PromotionDisplay } from "./promotion-display";
import { MemberQrScanner } from "./member-qr-scanner";
import { CouponQrScanner } from "./coupon-qr-scanner";
import { ProfilePhoto } from "./profile-photo";
import { normalizeCouponScan, normalizeMemberScan } from "@/lib/member-code";

type MemberLevel = "Platinum" | "Gold" | "Silver" | "Member";
type Customer = {
  id: string;
  memberCode: string;
  previousMemberCode: string;
  legacyMemberCode: string;
  formerMemberCode: string;
  memberNumber: number;
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
type LineProfile = { member_id: string; line_picture_url: string | null };
const ALIAS_KEY = "tammy-member-staff-aliases-v1";
type PointsData = Awaited<ReturnType<typeof fetchPointsData>>;

function loadMemberAliases(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const saved = window.localStorage.getItem(ALIAS_KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function toCustomers(rows: PointsData["members"]): Customer[] {
  const aliases = loadMemberAliases();
  return rows.map((m) => ({ id: m.id, memberCode: m.member_code || "", previousMemberCode: m.previous_member_code || "", legacyMemberCode: m.legacy_member_code || "", formerMemberCode: m.former_member_code || "", memberNumber: Number(m.member_number) || Number.MAX_SAFE_INTEGER, name: m.name, nickname: aliases[m.id] || "", phone: m.phone || "-", level: m.level as MemberLevel, points: Number(m.points) || 0, spending: Number(m.spending) || 0, birthDate: m.birth_date || "", createdAt: m.created_at || "", pinned: false })).sort((a, b) => a.memberNumber - b.memberNumber || a.createdAt.localeCompare(b.createdAt));
}

export function PointsManager() {
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const cached = cachedData<PointsData>("points");
    return cached ? toCustomers(cached.members) : [];
  });
  const [selectedId, setSelectedId] = useState("");
  const [birthdayClaims, setBirthdayClaims] = useState<Set<string>>(() => new Set(cachedData<PointsData>("points")?.birthdays.map((row) => row.member_id) ?? []));
  const [loading, setLoading] = useState(() => !cachedData<PointsData>("points"));
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [couponScanQr, setCouponScanQr] = useState("");
  const [scannerError, setScannerError] = useState("");
  const [scannedId, setScannedId] = useState("");
  const [linePictures, setLinePictures] = useState<Record<string, string>>(() => cachedLinePictures(crmOwnerId()));
  const [filter, setFilter] = useState<"ทั้งหมด" | "ปักหมุด" | "ใช้งานล่าสุด">("ทั้งหมด");
  const [saleInput, setSaleInput] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState({ earned: 0, total: 0 });
  const [systemSettings, setSystemSettings] = useState(defaultSettings);
  const selected = customers.find((customer) => customer.id === selectedId) ?? customers[0] ?? { id: "", memberCode: "", previousMemberCode: "", legacyMemberCode: "", formerMemberCode: "", memberNumber: Number.MAX_SAFE_INTEGER, name: "ยังไม่ได้เลือกลูกค้า", nickname: "", phone: "-", level: "Member" as const, points: 0, spending: 0, birthDate: "", createdAt: "", pinned: false };
  const sale = Number(saleInput) || 0;
  const pointRate = selected.level === "Platinum" ? systemSettings.platinumBahtPerPoint : selected.level === "Gold" ? systemSettings.goldBahtPerPoint : selected.level === "Silver" ? systemSettings.silverBahtPerPoint : systemSettings.pointsSpend;
  const pointUnit = 1;
  const award = calculateAward(sale, pointRate, 1, systemSettings.promotions, undefined, selected.createdAt, selected.birthDate, birthdayClaims.has(selected.id));
  const upgradeBonus = selected.level === "Platinum" ? 0 : selected.level === "Gold" ? (selected.spending + sale >= systemSettings.platinumMinSpend ? systemSettings.platinumUpgradeBonus : 0) : (selected.spending + sale >= systemSettings.goldMinSpend ? systemSettings.goldUpgradeBonus : 0) + (selected.spending + sale >= systemSettings.platinumMinSpend ? systemSettings.platinumUpgradeBonus : 0);
  const earned = systemSettings.accumulationEnabled ? award.total + upgradeBonus : 0;

  useEffect(() => {
    setSystemSettings(loadSettings());
    const update = () => setSystemSettings(loadSettings());
    window.addEventListener("tammy-settings-changed", update);
    return () => window.removeEventListener("tammy-settings-changed", update);
  }, []);

  useEffect(() => { void (async () => {
    if (loadAttempt) setLoading(true);
    setError("");
    if (!supabase) { setError("ยังไม่ได้ตั้งค่า Supabase"); setLoading(false); return; }
    try {
    const ownerId = crmOwnerId();
    if (!ownerId) throw new Error("ยังไม่พบสิทธิ์ของร้าน");
    setLinePictures(cachedLinePictures(ownerId));
    const result = await loadCachedData(ownerId, "points", () => fetchPointsData(ownerId));
    const extra = result.settings?.extra && typeof result.settings.extra === "object" ? result.settings.extra as Record<string, unknown> : null;
    if (extra?.points_policy_version === 1) setSystemSettings((current) => ({
      ...current,
      pointsSpend: Number(result.settings?.points_spend) || current.pointsSpend,
      pointsEarned: 1,
      silverBahtPerPoint: Number(extra.silver_baht_per_point) || Number(result.settings?.points_spend) || current.pointsSpend,
      silverPointsEarned: 1,
      goldMinSpend: Number(extra.gold_min_spend) || current.goldMinSpend,
      platinumMinSpend: Number(extra.platinum_min_spend) || current.platinumMinSpend,
      goldBahtPerPoint: Number(extra.gold_baht_per_point) || current.goldBahtPerPoint,
      goldPointsEarned: 1,
      platinumBahtPerPoint: Number(extra.platinum_baht_per_point) || current.platinumBahtPerPoint,
      platinumPointsEarned: 1,
      goldUpgradeBonus: Number.isInteger(extra.gold_upgrade_bonus) ? Number(extra.gold_upgrade_bonus) : current.goldUpgradeBonus,
      platinumUpgradeBonus: Number.isInteger(extra.platinum_upgrade_bonus) ? Number(extra.platinum_upgrade_bonus) : current.platinumUpgradeBonus,
      promotions: Array.isArray(extra.promotions) ? extra.promotions as typeof current.promotions : current.promotions,
      accumulationEnabled: typeof extra.accumulation_enabled === "boolean" ? extra.accumulation_enabled : current.accumulationEnabled,
    }));
    const mapped = toCustomers(result.members);
    setCustomers(mapped);
    setSelectedId((current) => current || mapped[0]?.id || "");

    setBirthdayClaims(new Set(result.birthdays.map((row) => row.member_id)));
    setLoading(false);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (token) {
        const response = await fetch("/api/line/messaging/member-profiles", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        if (response.ok) {
          const data = await response.json() as { profiles: LineProfile[] };
          setLinePictures(rememberLinePictures(ownerId, data.profiles));
        }
      }
    } catch { /* Member data remains usable when LINE profiles are unavailable. */ }
    } catch (error) { setError(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ"); }
    setLoading(false);
  })(); }, [loadAttempt]);

  const visible = useMemo(() => customers.filter((customer) => {
    if (scannedId && customer.id !== scannedId) return false;
    const searchMatch = `${customer.name} ${customer.nickname} ${customer.phone} ${customer.memberCode}`.toLowerCase().includes(query.trim().toLowerCase());
    const filterMatch = filter === "ทั้งหมด" || filter === "ใช้งานล่าสุด" || customer.pinned;
    return searchMatch && filterMatch;
  }), [customers, filter, query, scannedId]);

  function selectByCode(rawCode: string) {
    const code = normalizeMemberScan(rawCode);
    const match = customers.find((customer) => customer.memberCode.toUpperCase() === code || customer.previousMemberCode.toUpperCase() === code || customer.legacyMemberCode.toUpperCase() === code || customer.formerMemberCode.toUpperCase() === code);
    if (!match) { setScannerError("ไม่พบรหัสสมาชิกนี้ในร้าน กรุณาตรวจ QR หรือรหัสบนบัตร"); return false; }
    setSelectedId(match.id);
    setScannedId(match.id);
    setQuery("");
    setFilter("ทั้งหมด");
    setScannerError("");
    setScannerOpen(false);
    setSaleInput("");
    return true;
  }

  useEffect(()=>{if(loading)return;const url=new URL(window.location.href);const scan=url.searchParams.get("scan");if(!scan)return;selectByCode(scan);url.searchParams.delete("scan");window.history.replaceState(null,"",url.pathname+url.search+url.hash);},[loading,customers]);
  const pendingHardwareScan=useRef("");
  useEffect(()=>{
    if(!loading&&pendingHardwareScan.current){selectByCode(pendingHardwareScan.current);pendingHardwareScan.current="";}
    const receive=(event:Event)=>{const code=(event as CustomEvent<string>).detail;if(typeof code!=="string")return;if(loading)pendingHardwareScan.current=code;else selectByCode(code);};
    window.addEventListener("tammy-member-scan",receive);return()=>window.removeEventListener("tammy-member-scan",receive);
  },[loading,customers]);
  function routeScan(rawCode: string) {
    const couponQr = normalizeCouponScan(rawCode);
    if (couponQr) { setScannerOpen(false); setCouponScanQr(couponQr); setScannerError(""); return true; }
    return selectByCode(rawCode);
  }

  async function confirmPoints() {
    if (submitting || !supabase || !selected || sale <= 0 || earned <= 0 || !systemSettings.accumulationEnabled) return;
    setSubmitting(true); setError("");
    try {
      const { data, error: awardError } = await supabase.rpc("award_points", { target_member_id: selected.id, sale, earned, memo: "ให้แต้มจากหน้า CRM" });
      if (awardError) throw awardError;
      if (!data?.id) throw new Error("ฐานข้อมูลไม่ยืนยันรายการให้แต้ม");
      const total = Number(data.points);
      notifyCatalogChanged();
      setHistoryRevision(value => value + 1);
      setCustomers((current) => current.map((customer) => customer.id === selected.id ? { ...customer, points: total, level: data.level as MemberLevel, spending: Number(data.spending) } : customer));
      clearCachedData("points", "members", "reports");
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
      <div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/points" onClose={() => setMobileMenu(false)} /></div>
      <main className="main-content">
        <header className="page-header points-header">
          <button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button>
          <div className="title-icon"><Gift /></div>
          <div className="heading-copy"><h1>ให้แต้มลูกค้า</h1><p>ค้นหาสมาชิก ใส่ยอดซื้อ และให้แต้มได้ในขั้นตอนเดียว</p></div>
          <div className="header-actions"><span className="ready"><i /> พร้อมใช้งาน</span></div>
        </header>

        <div className="points-workspace">
          <section className="panel customer-panel">
            <div className="step-heading"><span>1</span><h2>เลือกลูกค้า</h2></div>
            <div className="points-customer-lookup"><label className="customer-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} disabled={!!scannedId} placeholder="ค้นหาชื่อ เบอร์โทร หรือรหัสสมาชิก" /></label><button type="button" className="points-scan-button" onClick={() => { setScannerError(""); setCouponScanQr(""); setScannerOpen(true); }}><ScanLine size={18} /> สแกนสมาชิก / คูปอง</button></div>
            {scannerError&&!scannerOpen&&<p className="rewards-gallery-error" role="alert">{scannerError}</p>}
            {scannedId ? <div className="points-scan-lock"><span>เลือกสมาชิกจาก QR แล้ว · {selected.name}</span><button type="button" onClick={() => { setScannedId(""); setQuery(""); }}>เปลี่ยนสมาชิก</button></div> : null}
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
                {loading ? <p className="rewards-gallery-empty">กำลังโหลดสมาชิก...</p> : !customers.length && error ? <div className="points-load-error" role="alert"><p>โหลดรายชื่อสมาชิกไม่สำเร็จ</p><button type="button" onClick={() => setLoadAttempt((current) => current + 1)}>ลองโหลดอีกครั้ง</button></div> : !customers.length ? <p className="rewards-gallery-empty">ยังไม่มีสมาชิกที่ให้แต้มได้</p> : null}
                {visible.map((customer) => <article key={customer.id} className={`customer-row${selectedId === customer.id ? " selected" : ""}`} role="button" tabIndex={0} aria-pressed={selectedId === customer.id} aria-label={`เลือก ${customer.name}${customer.nickname ? ` ชื่อที่จำ ${customer.nickname}` : ""}`} onClick={() => { if (!scannedId || scannedId === customer.id) setSelectedId(customer.id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); if (!scannedId || scannedId === customer.id) setSelectedId(customer.id); } }}>
                  <span className="customer-identity"><span className="pet-avatar"><ProfilePhoto src={linePictures[customer.id]} size={44} /></span><span className="customer-name">{customer.name}</span></span>
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
                <span className="pet-avatar large"><ProfilePhoto src={linePictures[selected.id]} size={58} /></span>
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

            <TransactionHistory revision={loadAttempt + historyRevision} onChanged={() => { clearCachedData("points", "members", "reports"); setLoadAttempt(value => value + 1); }} />
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
                <span className="pet-avatar"><ProfilePhoto src={linePictures[selected.id]} size={44} alt={`รูปโปรไฟล์ของ ${selected.name}`} /></span>
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
        {scannerOpen ? <MemberQrScanner onScan={routeScan} onClose={() => setScannerOpen(false)} error={scannerError} /> : null}
        {couponScanQr ? <CouponQrScanner initialQr={couponScanQr} onClose={() => setCouponScanQr("")} /> : null}
        {successOpen ? (
          <div className="preview-modal points-success-modal" role="dialog" aria-modal="true" aria-labelledby="points-success-title">
            <button className="preview-backdrop" type="button" aria-label="ปิด" onClick={() => setSuccessOpen(false)} />
            <section>
              <button className="preview-close" type="button" onClick={() => setSuccessOpen(false)} aria-label="ปิด"><X /></button>
              <span className="success-icon"><CheckCircle2 /></span>
              <h2 id="points-success-title">ให้แต้มสำเร็จ!</h2>
              <p>ระบบบันทึกรายการเรียบร้อยแล้ว</p>
              <div className="success-customer"><span className="pet-avatar"><ProfilePhoto src={linePictures[selected.id]} size={44} alt={`รูปโปรไฟล์ของ ${selected.name}`} /></span><span><strong>{selected.name}</strong><small>{selected.nickname} • {selected.phone}</small></span></div>
              <div className="success-points"><span>ได้รับ</span><strong>+{successReceipt.earned} แต้ม</strong><small>แต้มคงเหลือใหม่ {successReceipt.total.toLocaleString()} แต้ม</small></div>
              <button className="success-done" type="button" onClick={() => setSuccessOpen(false)}>เสร็จสิ้น</button>
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
