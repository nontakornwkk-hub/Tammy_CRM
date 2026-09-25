"use client";

import Image from "next/image";
import { DateRangePicker } from "./date-range-picker";
import {
  Bell,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Crown,
  Eye,
  ExternalLink,
  Gift,
  GripVertical,
  LockKeyhole,
  Menu,
  PawPrint,
  Pencil,
  Plus,
  Save,
  Shuffle,
  ShieldCheck,
  Smartphone,
  Store,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SiFacebook, SiInstagram, SiLine, SiTiktok, SiYoutube } from "react-icons/si";
import { AppSettings, ContactPlatform, defaultSettings, loadSettings, saveSettings } from "@/lib/settings";
import { supabase } from "@/lib/supabase/client";
import { bangkokToday, PROMOTION_PATTERN_COUNT, promotionPattern, type PointPromotion } from "@/lib/promotions";
import { PromotionDisplay } from "./promotion-display";
import { CardDesignSettings } from "./card-design-settings";
import { normalizeCardDesign } from "@/lib/card-design";
import { Sidebar } from "./sidebar";
import { PopupContentSettings } from "./popup-content-settings";
import { DatabaseUsageCard } from "./database-usage-card";
import { TeamSecuritySettings } from "./team-security-settings";
import { loadPopupCatalog, normalizePopupContent, resolvePopupContent } from "@/lib/popup-content";

type Tab = "shop" | "points" | "card" | "content" | "team";
type TeamMember = { id: number; name: string; email: string; role: "ผู้ดูแลระบบ" | "ผู้จัดการร้าน" | "พนักงาน"; active: boolean };

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "shop", label: "ข้อมูลร้านและภาพลักษณ์" },
  { id: "points", label: "สมาชิก แต้ม และแรงค์" },
  { id: "card", label: "บัตรสมาชิกและมาสคอต" },
  { id: "content", label: "เนื้อหาและสิทธิพิเศษ" },
  { id: "team", label: "ทีมงานและความปลอดภัย" },
];

const initialTeam: TeamMember[] = [
  { id: 1, name: "Admin", email: "admin@tammy.com", role: "ผู้ดูแลระบบ", active: true },
  { id: 2, name: "สมชาย ใจดี", email: "manager@tammy.com", role: "ผู้จัดการร้าน", active: true },
  { id: 3, name: "น้องเมย์", email: "may@tammy.com", role: "พนักงาน", active: true },
];


function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" className={`toggle${checked ? " on" : ""}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>;
}

export function SettingsManager() {
  const [activeTab, setActiveTab] = useState<Tab>("shop");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [team, setTeam] = useState(initialTeam);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    if (!supabase) return;
    void supabase.from("public_shop_profiles").select("*").eq("slug", "tammy").maybeSingle().then(({ data }) => {
      if (!data) return;
      const card = normalizeCardDesign(data.card_design);
      setSettings((current) => ({
        ...current,
        customerUrl: data.customer_url || current.customerUrl,
        shopName: data.shop_name || current.shopName,
        shopNameEn: data.shop_name_en || current.shopNameEn,
        description: data.description ?? current.description,
        welcomeMessage: data.welcome_message ?? current.welcomeMessage,
        logoDataUrl: data.logo_url || current.logoDataUrl,
        storeHoursEnabled: data.store_hours_enabled ?? current.storeHoursEnabled,
        contacts: Array.isArray(data.contacts) && data.contacts.length ? data.contacts : current.contacts,
        weeklyHours: Array.isArray(data.weekly_hours) && data.weekly_hours.length ? data.weekly_hours : current.weeklyHours,
        temporaryClosure: data.temporary_closure && typeof data.temporary_closure === "object" ? { ...current.temporaryClosure, ...data.temporary_closure } : current.temporaryClosure,
        cardThemes: card.themes, cardMascots: card.mascots, selectedTheme: card.selectedTheme, selectedMascot: card.selectedMascot, displayCustomization: card.displayCustomization,
        popupEnabled: typeof (data.card_design as Record<string, unknown>)?.popup_enabled === "boolean" ? Boolean((data.card_design as Record<string, unknown>).popup_enabled) : current.popupEnabled,
      }));
    });
    void supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user || !supabase) return;
      const { data } = await supabase.from("store_settings").select("extra,points_spend,points_earned").eq("owner_id", auth.user.id).maybeSingle();
      const extra = data?.extra && typeof data.extra === "object" ? data.extra as Record<string, unknown> : null;
      if (!extra || extra.points_policy_version !== 1) return;
      setSettings((current) => ({
        ...current,
        pointsSpend: Number(data?.points_spend) || current.pointsSpend,
        pointsEarned: Number(data?.points_earned) || current.pointsEarned,
        goldMinSpend: Number(extra.gold_min_spend) || current.goldMinSpend,
        platinumMinSpend: Number(extra.platinum_min_spend) || current.platinumMinSpend,
        goldBahtPerPoint: Number(extra.gold_baht_per_point) || current.goldBahtPerPoint,
        platinumBahtPerPoint: Number(extra.platinum_baht_per_point) || current.platinumBahtPerPoint,
        goldUpgradeBonus: Number.isInteger(extra.gold_upgrade_bonus) ? Number(extra.gold_upgrade_bonus) : current.goldUpgradeBonus,
        platinumUpgradeBonus: Number.isInteger(extra.platinum_upgrade_bonus) ? Number(extra.platinum_upgrade_bonus) : current.platinumUpgradeBonus,
        welcomeBonusEnabled: extra.welcome_bonus_enabled === true,
        welcomeBonusPoints: Number.isInteger(extra.welcome_bonus_points) && Number(extra.welcome_bonus_points) >= 1 ? Number(extra.welcome_bonus_points) : current.welcomeBonusPoints,
        pointsExpiration: extra.points_expiration === "รีทุกสิ้นปี" ? "รีทุกสิ้นปี" : "ไม่มีวันหมดอายุ",
        promotions: Array.isArray(extra.promotions) ? extra.promotions as PointPromotion[] : current.promotions,
        accumulationEnabled: typeof extra.accumulation_enabled === "boolean" ? extra.accumulation_enabled : current.accumulationEnabled,
        popupContent: Array.isArray(extra.popup_content) ? normalizePopupContent(extra.popup_content) : current.popupContent,
        popupEnabled: typeof extra.popup_enabled === "boolean" ? extra.popup_enabled : current.popupEnabled,
      }));
    });
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  async function persist() {
    if (saving) return;
    if (!supabase) { setSaveError("ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูล"); return; }
    const customerUrl = settings.customerUrl.trim() || `${window.location.origin}/customer`;
    if (!/^https?:\/\/[^\s]+$/i.test(customerUrl)) {
      setSaveError("กรุณาใส่ลิงก์หน้าลูกค้าเป็น https:// หรือ http:// ที่ถูกต้อง");
      return;
    }
    const closure = settings.temporaryClosure;
    if (closure.enabled && (!closure.startsOn || !closure.endsOn || closure.endsOn < closure.startsOn)) {
      setSaveError("กรุณาเลือกวันเริ่มและวันสิ้นสุดของประกาศปิดร้านให้ถูกต้อง");
      return;
    }
    if (closure.enabled && (!closure.reopensOn || closure.reopensOn <= closure.endsOn)) {
      setSaveError("กรุณาเลือกวันกลับมาเปิดร้านให้หลังวันสิ้นสุดของประกาศ");
      return;
    }
    if (settings.goldMinSpend >= settings.platinumMinSpend) {
      setSaveError("เกณฑ์ Platinum ต้องสูงกว่า Gold");
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("กรุณาเข้าสู่ระบบแอดมินก่อนบันทึกข้อมูลร้าน");
      let logoUrl = settings.logoDataUrl;
      if (logoUrl.startsWith("data:")) {
        const blob = await fetch(logoUrl).then((response) => response.blob());
        const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
        const path = `${auth.user.id}/shop-logo-${crypto.randomUUID()}.${ext}`;
        const upload = await supabase.storage.from("crm-content").upload(path, blob, { contentType: blob.type });
        if (upload.error) throw upload.error;
        logoUrl = supabase.storage.from("crm-content").getPublicUrl(path).data.publicUrl;
      }
      const cardMascots = await Promise.all(settings.cardMascots.map(async (mascot) => {
        if (!mascot.image.startsWith("data:")) return mascot;
        const blob = await fetch(mascot.image).then((response) => response.blob());
        const ext = blob.type === "image/png" ? "png" : blob.type === "image/jpeg" ? "jpg" : "webp";
        const path = `${auth.user.id}/card-mascot-${crypto.randomUUID()}.${ext}`;
        const upload = await supabase!.storage.from("crm-content").upload(path, blob, { contentType: blob.type });
        if (upload.error) throw upload.error;
        return { ...mascot, image: supabase!.storage.from("crm-content").getPublicUrl(path).data.publicUrl };
      }));
      const next = { ...settings, cardMascots, customerUrl, logoDataUrl: logoUrl, pointsExpiration: settings.pointsExpiration === "รีทุกสิ้นปี" ? "รีทุกสิ้นปี" : "ไม่มีวันหมดอายุ" };
      const publicPopupContent = next.popupContent.length
        ? resolvePopupContent(next.popupContent, await loadPopupCatalog()).filter(item => item.active)
        : [];
      const settingsRow = await supabase.from("store_settings").select("extra").eq("owner_id", auth.user.id).single();
      if (settingsRow.error) throw settingsRow.error;
      const previousExtra = settingsRow.data.extra && typeof settingsRow.data.extra === "object" ? settingsRow.data.extra as Record<string, unknown> : {};
      const pointSave = await supabase.from("store_settings").update({
        points_spend: next.pointsSpend,
        points_earned: next.pointsEarned,
        extra: {
          ...previousExtra,
          points_policy_version: 1,
          points_expiration: next.pointsExpiration === "รีทุกสิ้นปี" ? "รีทุกสิ้นปี" : "ไม่มีวันหมดอายุ",
          accumulation_enabled: next.accumulationEnabled,
          gold_min_spend: next.goldMinSpend,
          platinum_min_spend: next.platinumMinSpend,
          gold_baht_per_point: next.goldBahtPerPoint,
          platinum_baht_per_point: next.platinumBahtPerPoint,
          gold_upgrade_bonus: next.goldUpgradeBonus,
          platinum_upgrade_bonus: next.platinumUpgradeBonus,
          welcome_bonus_enabled: next.welcomeBonusEnabled,
          welcome_bonus_points: next.welcomeBonusPoints,
          promotions: next.promotions,
          popup_content: next.popupContent,
          popup_enabled: next.popupEnabled,
        },
        updated_at: new Date().toISOString(),
      }).eq("owner_id", auth.user.id);
      if (pointSave.error) throw pointSave.error;
      const result = await supabase.from("public_shop_profiles").upsert({
        slug: "tammy", owner_id: auth.user.id, customer_url: customerUrl,
        shop_name: next.shopName, shop_name_en: next.shopNameEn,
        description: next.description, welcome_message: next.welcomeMessage,
        logo_url: logoUrl || null, contacts: next.contacts, store_hours_enabled: next.storeHoursEnabled,
        weekly_hours: next.weeklyHours, temporary_closure: next.temporaryClosure,
        card_design: { themes: next.cardThemes, mascots: next.cardMascots, selectedTheme: next.selectedTheme, selectedMascot: next.selectedMascot, displayCustomization: next.displayCustomization, popup_enabled: next.popupEnabled, popup_content: publicPopupContent },
        updated_at: new Date().toISOString(),
      }, { onConflict: "slug" });
      if (result.error) throw result.error;
      saveSettings(next);
      setSettings(next);
      setDirty(false);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  function addTeamMember() {
    setTeam((current) => [...current, { id: Date.now(), name: "สมาชิกใหม่", email: "new@tammy.com", role: "พนักงาน", active: true }]);
    setDirty(true);
  }

  return (
    <div className="app-shell settings-page">
      <div className={`mobile-overlay${mobileMenu ? " show" : ""}`} onClick={() => setMobileMenu(false)} />
      <div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/settings" /></div>
      <main className="main-content">
        <header className="page-header settings-header">
          <button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button>
          <div className="heading-copy"><h1>ตั้งค่าระบบ</h1><p>จัดการข้อมูลร้าน สมาชิก และสิทธิ์การใช้งาน</p></div>
          <div className="header-actions"><span className={`save-state${dirty ? " dirty" : ""}`}><i /> {dirty ? "ยังไม่ได้บันทึก" : "บันทึกแล้ว"}</span><button className="button primary" type="button" onClick={persist} disabled={saving}><Save size={19} /> {saving ? "กำลังบันทึก…" : saved ? "บันทึกการตั้งค่า" : "บันทึกการเปลี่ยนแปลง"}</button></div>
        </header>

        <nav className="settings-tabs" aria-label="หมวดการตั้งค่า">
          {tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
        </nav>

        {activeTab === "shop" ? <ShopTab settings={settings} update={update} /> : null}
        {activeTab === "points" ? <PointsTab settings={settings} update={update} /> : null}
        {activeTab === "card" ? <CardTab settings={settings} update={update} /> : null}
        {activeTab === "content" ? <PopupContentSettings settings={settings} update={update} /> : null}
        {activeTab === "team" ? <TeamSecuritySettings /> : null}
        {activeTab === "team" ? <div className="database-usage-wrap"><DatabaseUsageCard /></div> : null}

        {saveError ? <p className="settings-save-error" role="alert">{saveError}</p> : null}
      </main>
    </div>
  );
}

type Update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;

const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const displayShopDate = (value: string) => value ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)) : "";
function WheelColumn({ options, value, label, disabled, onChange }: { options: string[]; value: string; label: string; disabled: boolean; onChange: (value: string) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const index = options.indexOf(value);
    if (scroller.current && index >= 0 && Math.abs(scroller.current.scrollTop - index * 36) > 18) scroller.current.scrollTop = index * 36;
  }, [options, value]);
  return <div className="shop-wheel-column" role="listbox" aria-label={label} aria-disabled={disabled} onScroll={(event) => { if (disabled) return; const index = Math.max(0, Math.min(options.length - 1, Math.round(event.currentTarget.scrollTop / 36))); if (options[index] !== value) onChange(options[index]); }} ref={scroller}>{options.map((option, index) => <button type="button" role="option" aria-selected={option === value} tabIndex={option === value ? 0 : -1} disabled={disabled} key={option} onClick={() => { onChange(option); scroller.current?.scrollTo({ top: index * 36, behavior: "smooth" }); }} onKeyDown={(event) => { if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return; event.preventDefault(); const next = Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))); onChange(options[next]); scroller.current?.scrollTo({ top: next * 36, behavior: "smooth" }); }}>{option}</button>)}</div>;
}
function TimeSelect({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }) {
  const [hour = "08", minute = "00"] = value.split(":");
  return <div className="shop-time-field"><span>{label}</span><div className="shop-time-wheel"><WheelColumn label={`${label} ชั่วโมง`} options={hours} value={hour} disabled={disabled} onChange={(next) => onChange(`${next}:${minute}`)} /><b>:</b><WheelColumn label={`${label} นาที`} options={minutes} value={minute} disabled={disabled} onChange={(next) => onChange(`${hour}:${next}`)} /></div></div>;
}

function ShopTab({ settings, update }: { settings: AppSettings; update: Update }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [imageStatus, setImageStatus] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedDay, setSelectedDay] = useState(0);
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const shareUrl = settings.customerUrl || (origin ? `${origin}/customer` : "");
  useEffect(() => {
    let current = true;
    if (!/^https?:\/\/[^\s]+$/i.test(shareUrl)) { setQrImage(""); return; }
    void import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(shareUrl, { width: 320, margin: 2, errorCorrectionLevel: "M" }))
      .then((value) => { if (current) setQrImage(value); })
      .catch(() => { if (current) setQrImage(""); });
    return () => { current = false; };
  }, [shareUrl]);

  async function readImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    setImageStatus(file.size > 3_000_000 ? "กำลังบีบอัดรูปภาพ…" : "กำลังอ่านรูปภาพ…");
    try {
      const result = file.size > 3_000_000 ? await compressImage(file) : await fileToDataUrl(file);
      update("logoDataUrl", result.dataUrl);
      setImageStatus(result.compressed ? `บีบอัดสำเร็จ เหลือ ${formatBytes(result.size)}` : `อัปโหลดสำเร็จ ${formatBytes(result.size)}`);
    } catch {
      setImageStatus("");
      window.alert("ไม่สามารถอ่านหรือบีบอัดรูปนี้ได้ กรุณาลองไฟล์อื่น");
    }
  }

  function patchContact(id: number, key: "platform" | "label" | "value" | "url" | "active", value: string | boolean) {
    update("contacts", settings.contacts.map((contact) => contact.id === id ? { ...contact, [key]: value } : contact));
  }

  function addContact() {
    const contact = { id: Date.now(), platform: "tiktok" as ContactPlatform, label: "TikTok", value: "@tammypetshop", url: "https://www.tiktok.com/@tammypetshop", active: true };
    update("contacts", [...settings.contacts, contact]);
    setEditingId(contact.id);
  }

  const patchDay = (key: "open" | "opensAt" | "closesAt", value: boolean | string) => update("weeklyHours", settings.weeklyHours.map((day, index) => index === selectedDay ? { ...day, [key]: value } : day));
  const patchClosure = (patch: Partial<AppSettings["temporaryClosure"]>) => update("temporaryClosure", { ...settings.temporaryClosure, ...patch });
  function setClosureRange(start: string, end: string) {
    const nextDay = end ? new Date(Date.parse(`${end}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : "";
    patchClosure({ startsOn: start, endsOn: end, reopensOn: end && (!settings.temporaryClosure.reopensOn || settings.temporaryClosure.reopensOn <= end) ? nextDay : settings.temporaryClosure.reopensOn });
  }

  return <div className="shop-settings-layout">
    <div className="settings-column">
      <section className="settings-card shop-identity-card">
        <div className="card-heading"><div><h2>ตัวตนร้าน</h2><p>ข้อมูลพื้นฐานของร้าน ที่จะแสดงให้ลูกค้าเห็น</p></div></div>
        <div className="shop-profile">
          <div className="logo-uploader">
            <div className="logo-preview-static"><Image src={settings.logoDataUrl || "/assets/tammy-logo-cat.png"} alt="ตัวอย่างโลโก้ร้าน" fill unoptimized={Boolean(settings.logoDataUrl)} sizes="160px" style={{ objectFit: "contain" }} /></div>
            <label><Upload size={17} /> เปลี่ยนรูปโลโก้<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImage(event.target.files?.[0])} /></label>
            <small>รองรับ PNG, JPG, WEBP • เกิน 3 MB จะบีบอัดอัตโนมัติ</small>
          </div>
          <div className="settings-fields">
            <div className="shop-name-fields"><label>ชื่อร้าน (ภาษาไทย)<input value={settings.shopName} onChange={(event) => update("shopName", event.target.value)} /></label><label>ชื่อร้าน (ภาษาอังกฤษ)<input value={settings.shopNameEn} onChange={(event) => update("shopNameEn", event.target.value)} /></label></div>
            <label>คำอธิบายร้าน (สั้น ๆ)<textarea value={settings.description} maxLength={200} onChange={(event) => update("description", event.target.value)} /><small className="field-count">{settings.description.length}/200</small></label>
            <label>ข้อความต้อนรับลูกค้า<textarea value={settings.welcomeMessage} maxLength={200} onChange={(event) => update("welcomeMessage", event.target.value)} /><small className="field-count">{settings.welcomeMessage.length}/200</small></label>
          </div>
        </div>

        {imageStatus ? <p className="image-status" aria-live="polite">{imageStatus}</p> : null}
      </section>
      <section className="settings-card shop-hours-card">
        <div className="card-heading"><div><h2>เวลาเปิด – ปิดร้าน</h2><p>กำหนดเวลาให้บริการของร้านในแต่ละวัน</p></div><div className="shop-hours-visibility"><span>แสดงบนหน้าลูกค้า</span><Switch checked={settings.storeHoursEnabled} onChange={() => update("storeHoursEnabled", !settings.storeHoursEnabled)} label="แสดงเวลาทำการบนหน้าลูกค้า" /></div></div>
        <div className="shop-day-grid">{settings.weeklyHours.map((day, index) => <button key={day.day} type="button" className={`shop-day ${selectedDay === index ? "selected" : ""} ${day.open ? "" : "closed"}`} onClick={() => setSelectedDay(index)}><strong>{day.day}</strong><small>{day.open ? `${day.opensAt} – ${day.closesAt}` : "ปิด"}</small></button>)}</div>
        <div className="shop-day-editor"><div className="shop-day-editor-title"><strong>{settings.weeklyHours[selectedDay]?.day}</strong><Switch checked={settings.weeklyHours[selectedDay]?.open ?? false} onChange={() => patchDay("open", !settings.weeklyHours[selectedDay]?.open)} label="เปิดร้านวันนี้" /></div><TimeSelect label="เวลาเปิด" value={settings.weeklyHours[selectedDay]?.opensAt || "08:00"} disabled={!settings.weeklyHours[selectedDay]?.open} onChange={(value) => patchDay("opensAt", value)} /><TimeSelect label="เวลาปิด" value={settings.weeklyHours[selectedDay]?.closesAt || "20:30"} disabled={!settings.weeklyHours[selectedDay]?.open} onChange={(value) => patchDay("closesAt", value)} /></div>
        <button className="shop-apply-hours" type="button" disabled={!settings.weeklyHours[selectedDay]?.open} onClick={() => { const source = settings.weeklyHours[selectedDay]; update("weeklyHours", settings.weeklyHours.map((day) => day.open ? { ...day, opensAt: source.opensAt, closesAt: source.closesAt } : day)); }}>ใช้เวลา {settings.weeklyHours[selectedDay]?.opensAt}–{settings.weeklyHours[selectedDay]?.closesAt} กับทุกวันที่เปิด</button>
        <div className="temporary-closure"><div className="card-heading"><div><h3>ประกาศปิดร้านชั่วคราว</h3><p>วันหยุดเทศกาลหรือหยุดให้บริการพิเศษ แยกจากเวลาทำการปกติ</p></div><Switch checked={settings.temporaryClosure.enabled} onChange={() => patchClosure({ enabled: !settings.temporaryClosure.enabled })} label="เปิดประกาศปิดร้าน" /></div>{settings.temporaryClosure.enabled ? <><div className="closure-dates"><label>ช่วงวันที่หยุด<DateRangePicker start={settings.temporaryClosure.startsOn} end={settings.temporaryClosure.endsOn} onChange={setClosureRange} label="วันที่เริ่ม – สิ้นสุด"/></label><label>กลับมาเปิดอีกครั้ง<DateRangePicker single start={settings.temporaryClosure.reopensOn} end="" onChange={(start) => patchClosure({ reopensOn: start })} label="วันที่กลับมาเปิด"/></label></div><label>เหตุผล (สั้น ๆ)<input maxLength={120} placeholder="เช่น หยุดในวันหยุดพิเศษ" value={settings.temporaryClosure.reason} onChange={(event) => patchClosure({ reason: event.target.value })} /></label><div className="closure-preview">📣 <span><strong>ประกาศปิดร้านชั่วคราว</strong><small>{settings.temporaryClosure.reason || "ระบุเหตุผลเพื่อให้ลูกค้าทราบ"}{settings.temporaryClosure.reopensOn ? ` · เปิดอีกครั้ง ${displayShopDate(settings.temporaryClosure.reopensOn)}` : ""}</small></span></div></> : null}</div>
      </section>
    </div>
    <div className="settings-column">
      <section className="settings-card customer-link-card">
        <div className="card-heading"><div><h2>ลิงก์หน้าลูกค้า</h2><p>ลิงก์สำหรับให้ลูกค้าเข้าหน้าร้านของคุณ เพื่อดูข้อมูล นัดหมาย หรือใช้บริการต่าง ๆ</p></div></div>
        <div className="customer-link-field"><input aria-label="ลิงก์หน้าลูกค้า" type="url" value={shareUrl} placeholder="https://example.com/customer" onChange={(event) => update("customerUrl", event.target.value)} /><button type="button" onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}><Copy size={17}/>{copied ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</button></div>
        {origin.startsWith("http://localhost") && shareUrl.startsWith(origin) ? <p className="shop-local-warning">ลิงก์ localhost เปิดได้เฉพาะเครื่องนี้ ก่อนส่งลูกค้าให้เปลี่ยนเป็นลิงก์เว็บไซต์จริง</p> : null}
        <div className="shop-qr-panel">{qrImage ? <Image src={qrImage} alt="QR Code ลิงก์หน้าลูกค้า" width={112} height={112} unoptimized /> : <div className="qr-placeholder">ใส่ลิงก์ที่ถูกต้อง<br/>เพื่อสร้าง QR</div>}<div><strong>QR Code สำหรับลูกค้า</strong><p>ให้ลูกค้าสแกนเพื่อเข้าหน้าร้านได้อย่างสะดวก รวดเร็ว</p>{qrImage ? <a className="qr-download" href={qrImage} download="tammy-customer-qr.png"><Upload size={16}/> ดาวน์โหลด QR</a> : null}</div><Image className="shop-qr-cat" src="/assets/member-mascot-cat.png" alt="" width={90} height={100}/></div>
      </section>
      <section className="settings-card shop-contacts-card">
        <div className="card-heading"><div><h2>ช่องทางติดต่อร้าน</h2><p>เพิ่ม แก้ไข และเปิด–ปิดช่องทางได้อิสระ</p></div><button className="settings-add compact" type="button" onClick={addContact}><Plus /> เพิ่มช่องทาง</button></div>
        <div className="contact-manager">
          {settings.contacts.map((contact) => <div className={`contact-row${editingId === contact.id ? " editing" : ""}`} key={contact.id}>
            <span className={`contact-icon ${contact.platform}`}><PlatformIcon platform={contact.platform} /></span>
            {editingId === contact.id ? <span className="contact-edit-fields"><select aria-label="แพลตฟอร์ม" value={contact.platform} onChange={(event) => patchContact(contact.id, "platform", event.target.value)}>{platformOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input aria-label="ชื่อช่องทาง" value={contact.label} onChange={(event) => patchContact(contact.id, "label", event.target.value)} /><input aria-label="ข้อมูลติดต่อ" value={contact.value} onChange={(event) => patchContact(contact.id, "value", event.target.value)} /><input aria-label="ลิงก์ช่องทาง" type="url" placeholder="https://..." value={contact.url} onChange={(event) => patchContact(contact.id, "url", event.target.value)} /></span> : <span className="contact-copy"><strong>{contact.label}</strong><small>{contact.value}</small>{contact.url ? <a href={contact.url} target="_blank" rel="noreferrer"><ExternalLink size={12} /> เปิดลิงก์</a> : null}</span>}
            <button className="contact-edit" type="button" onClick={() => setEditingId(editingId === contact.id ? null : contact.id)} aria-label={editingId === contact.id ? "เสร็จสิ้น" : "แก้ไข"}>{editingId === contact.id ? <Check size={17} /> : <Pencil size={17} />}</button>
            <Switch checked={contact.active} onChange={() => patchContact(contact.id, "active", !contact.active)} label={contact.label} />
            <button className="contact-delete" type="button" onClick={() => update("contacts", settings.contacts.filter((item) => item.id !== contact.id))} aria-label="ลบช่องทาง"><Trash2 size={16} /></button>
          </div>)}
        </div>
        {settings.contacts.length === 0 ? <div className="empty-contacts"><Store /><span>ยังไม่มีช่องทางติดต่อ</span><button type="button" onClick={addContact}>เพิ่มช่องทางแรก</button></div> : null}
      </section>
    </div>
  </div>;
}

const platformOptions: Array<{ value: ContactPlatform; label: string }> = [{ value: "line", label: "LINE" }, { value: "facebook", label: "Facebook" }, { value: "instagram", label: "Instagram" }, { value: "tiktok", label: "TikTok" }, { value: "youtube", label: "YouTube" }, { value: "phone", label: "โทรศัพท์" }, { value: "website", label: "เว็บไซต์ / อื่น ๆ" }];

function PlatformIcon({ platform }: { platform: ContactPlatform }) {
  if (platform === "line") return <SiLine />;
  if (platform === "facebook") return <SiFacebook />;
  if (platform === "instagram") return <SiInstagram />;
  if (platform === "tiktok") return <SiTiktok />;
  if (platform === "youtube") return <SiYoutube />;
  if (platform === "phone") return <Smartphone />;
  return <ExternalLink />;
}

function fileToDataUrl(file: Blob): Promise<{ dataUrl: string; size: number; compressed: boolean }> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.addEventListener("load", () => resolve({ dataUrl: String(reader.result), size: file.size, compressed: false })); reader.addEventListener("error", reject); reader.readAsDataURL(file); });
}

async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  let width = bitmap.width;
  let height = bitmap.height;
  const maxSide = 2400;
  if (Math.max(width, height) > maxSide) { const ratio = maxSide / Math.max(width, height); width = Math.round(width * ratio); height = Math.round(height * ratio); }
  let quality = 0.86;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    canvas.getContext("2d", { alpha: false })?.drawImage(bitmap, 0, 0, width, height);
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
    if (blob && blob.size <= 2_250_000) break;
    quality = Math.max(0.48, quality - 0.08); width = Math.round(width * 0.88); height = Math.round(height * 0.88);
  }
  bitmap.close();
  if (!blob || blob.size > 2_250_000) throw new Error("compression-failed");
  const result = await fileToDataUrl(blob);
  return { ...result, compressed: true };
}

function formatBytes(size: number) { return size < 1_000_000 ? `${Math.round(size / 1000)}KB` : `${(size / 1_000_000).toFixed(1)}MB`; }

function PromotionSettings({ promotions, onChange }: { promotions: PointPromotion[]; onChange: (promotions: PointPromotion[]) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);
  const selected = promotions.find((promotion) => promotion.id === selectedId) ?? null;
  const selectedIndex = selected ? promotions.findIndex((promotion) => promotion.id === selected.id) : -1;
  function change(id: string, patch: Partial<PointPromotion>) {
    onChange(promotions.map((promotion) => promotion.id === id ? { ...promotion, ...patch } : promotion));
  }
  function move(id: string, targetId: string) {
    const index = promotions.findIndex((item) => item.id === id);
    const targetIndex = promotions.findIndex((item) => item.id === targetId);
    if (index < 0 || targetIndex < 0 || index === targetIndex) return;
    // Older promotions have no saved pattern. Lock in what is currently visible
    // before reordering, so their artwork travels with the promotion.
    const next = promotions.map((promotion, currentIndex) => ({
      ...promotion,
      themePattern: promotionPattern(promotion, currentIndex),
    }));
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    onChange(next);
  }
  function add(type: PointPromotion["type"] = "multiplier") {
    const today = bangkokToday();
    const end = new Date(today + "T12:00:00+07:00");
    end.setUTCDate(end.getUTCDate() + 7);
    const promotion: PointPromotion = {
      id: crypto.randomUUID(),
      title: type === "birthday" ? "แต้มพิเศษเดือนเกิด" : "โปรโมชั่นใหม่",
      enabled: true,
      startsOn: today,
      endsOn: end.toISOString().slice(0, 10),
      type,
      minSpend: 0,
      multiplier: 2,
      bonusPoints: 20,
      stepSpend: 500,
      newMemberDays: 30,
      themePattern: promotions.length % PROMOTION_PATTERN_COUNT,
    };
    onChange([...promotions, promotion]);
    setSelectedId(promotion.id);
  }
  const types: Array<{ id: PointPromotion["type"]; label: string; hint: string }> = [
    { id: "multiplier", label: "คูณแต้ม", hint: "เช่น แต้ม x2" },
    { id: "threshold", label: "ซื้อครบรับโบนัส", hint: "ครบยอด รับแต้มเพิ่ม" },
    { id: "repeat", label: "โบนัสทุกยอด", hint: "ทุกยอดที่กำหนด" },
    { id: "new_member", label: "สมาชิกใหม่", hint: "ภายใน X วันหลังสมัคร" },
    { id: "birthday", label: "วันเกิดสมาชิก", hint: "ซื้อในเดือนเกิด · ปีละครั้ง" },
  ];
  return <section className="settings-card promotion-settings promotion-manager">
    <div className="card-heading"><div><h2>โปรโมชั่นให้แต้ม</h2><p>จับหูด้านซ้ายแล้วลากเพื่อเปลี่ยนลำดับ · คลิกแบนเนอร์เพื่อแก้ไข · ระบบใช้โปรที่ให้โบนัสสูงสุดเพียงโปรเดียว</p></div></div>
    <div className="promotion-actions">
      <button className="settings-add compact" type="button" onClick={() => add()}><Plus /> เพิ่มโปรโมชั่น</button>
      <button className="settings-add compact birthday-add" type="button" onClick={() => add("birthday")}><Gift /> เพิ่มโปรวันเกิด</button>
    </div>
    {promotions.length ? <div className="promotion-manage-list" aria-label="รายการโปรโมชั่น เรียงจากบนลงล่าง">
      {promotions.map((promotion, index) => <div className={"promotion-manage-row" + (selectedId === promotion.id ? " selected" : "") + (dropId === promotion.id && draggedId !== promotion.id ? " drop-target" : "") + (draggedId === promotion.id ? " dragging" : "")} key={promotion.id}
        onDragOver={(event) => { if (!draggedId || draggedId === promotion.id) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropId(promotion.id); }}
        onDrop={(event) => { event.preventDefault(); if (draggedId) move(draggedId, promotion.id); setDraggedId(null); setDropId(null); }}
        onDragEnd={() => { setDraggedId(null); setDropId(null); }}>
        <button type="button" className="promotion-drag-handle" draggable aria-label={"ลากเพื่อจัดลำดับ " + promotion.title} title="ลากเพื่อเปลี่ยนลำดับ" onDragStart={(event) => { setDraggedId(promotion.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", promotion.id); }} onKeyDown={(event) => { if (event.key === "ArrowUp" && index > 0) { event.preventDefault(); move(promotion.id, promotions[index - 1].id); } else if (event.key === "ArrowDown" && index < promotions.length - 1) { event.preventDefault(); move(promotion.id, promotions[index + 1].id); } }}><GripVertical size={22} /></button>
        <button type="button" className="promotion-manage-select" onClick={() => setSelectedId(promotion.id)} aria-current={selectedId === promotion.id ? "true" : undefined} aria-label={"แก้ไข " + promotion.title}>
          <PromotionDisplay promotion={promotion} index={index} />
        </button>
        <div className="promotion-manage-controls">
          <span className={"promotion-row-state " + (promotion.enabled ? "on" : "off")}>{promotion.enabled ? "เปิด" : "ปิด"}</span>
          <Switch checked={promotion.enabled} onChange={() => change(promotion.id, { enabled: !promotion.enabled })} label={"เปิดโปรโมชั่น " + promotion.title} />
        </div>
      </div>)}
    </div> : <p className="promotion-empty">ยังไม่มีโปรโมชั่น · สมาชิกจะได้รับแต้มตามกฎพื้นฐานเท่านั้น</p>}
    {selected ? <div className="promotion-edit-panel promotion-editor">
      <div className="promotion-edit-title"><div><strong>แก้ไขโปรโมชั่น</strong><small>เลือกเงื่อนไขและดูหน้าตาที่จะแสดงในหน้าให้แต้ม</small></div><button type="button" className="promotion-remove" aria-label={"ลบ " + selected.title} onClick={() => { onChange(promotions.filter((promotion) => promotion.id !== selected.id)); setSelectedId(null); }}><Trash2 size={17} /></button></div>
      <label className="promotion-name-field">ชื่อโปรโมชั่น<input aria-label="ชื่อโปรโมชั่น" value={selected.title} onChange={(event) => change(selected.id, { title: event.target.value })} /></label>
      <div className="promotion-type-options">{types.map((type) => <button type="button" key={type.id} className={selected.type === type.id ? "selected" : ""} aria-pressed={selected.type === type.id} onClick={() => change(selected.id, { type: type.id })}><strong>{type.label}</strong><small>{type.hint}</small></button>)}</div>
      <div className="promotion-editor-grid">
        {selected.type === "birthday" ? <p className="birthday-rule">ใช้ได้ตลอดปี เฉพาะเดือนเกิดของสมาชิกที่ระบุวันเกิดไว้ และรับโบนัสได้ปีละ 1 ครั้ง</p> : <div className="promotion-range"><span>ช่วงวันที่ใช้งาน</span><DateRangePicker start={selected.startsOn} end={selected.endsOn} onChange={(start, end) => change(selected.id, { startsOn: start, endsOn: end })} label="ช่วงวันที่โปรโมชั่น" /></div>}
        <label>ยอดซื้อขั้นต่ำ (บาท)<input type="number" min="0" value={selected.minSpend} onChange={(event) => change(selected.id, { minSpend: Math.max(0, Number(event.target.value)) })} /></label>
        {selected.type === "multiplier" ? <label>ตัวคูณแต้ม<input type="number" min="1" max="10" step=".5" value={selected.multiplier} onChange={(event) => change(selected.id, { multiplier: Math.max(1, Number(event.target.value)) })} /></label> : <label>แต้มโบนัส<input type="number" min="1" value={selected.bonusPoints} onChange={(event) => change(selected.id, { bonusPoints: Math.max(1, Number(event.target.value)) })} /></label>}
        {selected.type === "repeat" ? <label>เพิ่มแต้มทุกยอดซื้อ (บาท)<input type="number" min="1" value={selected.stepSpend} onChange={(event) => change(selected.id, { stepSpend: Math.max(1, Number(event.target.value)) })} /></label> : null}
        {selected.type === "new_member" ? <label>ภายในกี่วันหลังสมัคร<input type="number" min="1" max="365" value={selected.newMemberDays ?? 30} onChange={(event) => change(selected.id, { newMemberDays: Math.max(1, Math.min(365, Number(event.target.value))) })} /></label> : null}
      </div>
      <div className="promotion-preview-head"><span>ลายที่แสดงในหน้าให้แต้ม · แบบ {promotionPattern(selected, selectedIndex) + 1} จาก 5</span><button type="button" onClick={() => change(selected.id, { themePattern: (promotionPattern(selected, selectedIndex) + 1) % PROMOTION_PATTERN_COUNT })}><Shuffle size={16} /> เปลี่ยนลาย</button></div>
      <PromotionDisplay promotion={selected} index={selectedIndex} />
    </div> : promotions.length ? <p className="promotion-select-hint">เลือกโปรโมชั่นจากรายการด้านบนเพื่อแก้ไขและดูตัวอย่าง</p> : null}
  </section>;
}

function PointsTab({ settings, update }: { settings: AppSettings; update: Update }) {
  return <div className="settings-grid points-settings-grid">
    <div className="settings-column">
      <section className="settings-card points-policy-card"><div className="card-heading"><div><h2>กฎการสะสมแต้ม</h2><p>กำหนดอัตราแต้มพื้นฐานและอายุแต้ม</p></div><div className="points-policy-switch"><span>เปิดการสะสมแต้ม</span><Switch checked={settings.accumulationEnabled} onChange={() => update("accumulationEnabled", !settings.accumulationEnabled)} label="เปิดการสะสมแต้ม" /></div></div><div className="points-rule"><span>ทุกยอดซื้อ</span><input aria-label="ยอดซื้อบาทต่อแต้ม" type="number" min="1" value={settings.pointsSpend} onChange={(event) => update("pointsSpend", Math.max(1, Number(event.target.value)))} /><span>บาท</span><b>→</b><span>ได้รับ</span><input aria-label="จำนวนแต้มที่ได้รับ" type="number" min="1" value={settings.pointsEarned} onChange={(event) => update("pointsEarned", Math.max(1, Number(event.target.value)))} /><span>แต้ม</span></div><div className="points-expiry-row"><label>อายุแต้ม<select value={settings.pointsExpiration === "รีทุกสิ้นปี" ? "รีทุกสิ้นปี" : "ไม่มีวันหมดอายุ"} onChange={(event) => update("pointsExpiration", event.target.value)}><option>ไม่มีวันหมดอายุ</option><option>รีทุกสิ้นปี</option></select></label><p>{settings.pointsExpiration === "รีทุกสิ้นปี" ? "หลังเปิดใช้ ระบบจะรีเซ็ตยอดแต้มคงเหลือทั้งหมดทุกวันที่ 1 มกราคม เวลา 00:05 น. (เวลาไทย) โดยบันทึกรายการตัดแต้มไว้ตรวจสอบย้อนหลัง" : "แต้มคงอยู่จนกว่าจะมีการใช้หรือปรับแก้โดยพนักงาน"}</p></div></section>
      <section className="settings-card welcome-bonus-card"><div className="card-heading"><div><h2>แต้มต้อนรับสมาชิกใหม่</h2><p>ให้ครั้งเดียวทันทีเมื่อเพิ่มสมาชิกสำเร็จ ไม่ต้องมียอดซื้อ</p></div><Switch checked={settings.welcomeBonusEnabled} onChange={() => update("welcomeBonusEnabled", !settings.welcomeBonusEnabled)} label="เปิดแต้มต้อนรับสมาชิกใหม่" /></div><div className="welcome-bonus-value"><Gift size={20} /><span>สมัครครั้งแรกได้รับ</span><input aria-label="จำนวนแต้มต้อนรับ" type="number" min="1" max="10000" step="1" disabled={!settings.welcomeBonusEnabled} value={settings.welcomeBonusPoints} onChange={(event) => update("welcomeBonusPoints", Math.max(1, Math.min(10000, Math.trunc(Number(event.target.value) || 1))))} /><strong>แต้ม</strong></div><p className="welcome-bonus-note">ใช้เฉพาะสมาชิกที่สมัครหลังเปิดใช้งาน ไม่ให้ย้อนหลัง และมีประวัติแต้มให้ตรวจสอบ</p></section>
      <section className="settings-card rank-settings-card">
        <div className="card-heading"><div><h2>แรงค์สมาชิก</h2><p>ยอดซื้อถึงเกณฑ์จะเลื่อนระดับอัตโนมัติ · โบนัสเลื่อนขั้นให้ครั้งเดียวต่อระดับ</p></div><Crown size={25} /></div>
        <div className="rank-tier-card silver"><strong>Silver / Member</strong><span>อัตราปกติ · ทุก {settings.pointsSpend} บาท = {settings.pointsEarned} แต้ม</span></div>
        {([{ name: "Gold", minimum: "goldMinSpend", rate: "goldBahtPerPoint", bonus: "goldUpgradeBonus" }, { name: "Platinum", minimum: "platinumMinSpend", rate: "platinumBahtPerPoint", bonus: "platinumUpgradeBonus" }] as const).map((rank) => <div className={`rank-tier-card ${rank.name.toLowerCase()}`} key={rank.name}>
          <strong><Crown size={17} /> {rank.name}</strong>
          <div><label>เลื่อนขั้นเมื่อซื้อสะสม<input type="number" min="1" value={settings[rank.minimum]} onChange={(event) => update(rank.minimum, Math.max(1, Math.trunc(Number(event.target.value) || 1)))} />บาท</label><label>ทุก<input type="number" min="1" value={settings[rank.rate]} onChange={(event) => update(rank.rate, Math.max(1, Math.trunc(Number(event.target.value) || 1)))} />บาท = 1 แต้ม</label><label>โบนัสเลื่อนขั้น<input type="number" min="0" value={settings[rank.bonus]} onChange={(event) => update(rank.bonus, Math.max(0, Math.trunc(Number(event.target.value) || 0)))} />แต้ม</label></div>
        </div>)}
        <p className="rank-card-note">อัตราของแรงค์ใหม่เริ่มใช้กับการซื้อครั้งถัดไป · สมาชิกเดิมไม่ถูกลดระดับเมื่อเปลี่ยนเกณฑ์</p>
      </section>
    </div>
    <div className="settings-column">
      <PromotionSettings promotions={settings.promotions} onChange={(promotions) => update("promotions", promotions)} />
      <section className="settings-card rank-guidance-card"><Crown /><div><strong>การรีแรงค์สมาชิก</strong><p>ตอนนี้ระบบเลื่อนระดับตามยอดซื้อสะสม แต่ยังไม่ลดระดับอัตโนมัติ การรีแรงค์รอบ 2–3 ปีต้องกำหนดเกณฑ์รักษาระดับและช่วงผ่อนผันก่อนเปิดใช้งาน</p></div></section>
    </div>
  </div>;
}

function CardTab({ settings, update }: { settings: AppSettings; update: Update }) {
  return <CardDesignSettings settings={settings} update={update} />;
}

function ContentTab({ settings, update }: { settings: AppSettings; update: Update }) {
  const [content, setContent] = useState([["โปรพิเศษประจำเดือน", true], ["ลดอาหารสัตว์ 10%", true], ["ขนมแมวเลีย 4 ชิ้น", true]] as Array<[string, boolean]>);
  return <div className="settings-grid"><div className="settings-column"><section className="settings-card"><h2>การแสดง Popup หลัง Login</h2><p>เลือกเนื้อหาที่จะแจ้งลูกค้าหลังเข้าสู่ระบบ</p><div className="settings-switch-title"><Switch checked={settings.popupEnabled} onChange={() => update("popupEnabled", !settings.popupEnabled)} label="Popup โปรโมชั่น" /> เปิด Popup โปรโมชั่น</div><div className="popup-list">{content.map(([name, enabled], index) => <div key={name}><GripVertical /><span className={`popup-thumb p${index}`}><Gift /></span><span className={`content-badge p${index}`}>{index === 0 ? "ข่าวสาร" : index === 1 ? "คูปอง" : "ของรางวัล"}</span><strong>{name}</strong><Switch checked={enabled} onChange={() => setContent((current) => current.map((item, itemIndex) => itemIndex === index ? [item[0], !item[1]] : item))} label={name} /><em>ลำดับ {index + 1}</em></div>)}</div><button className="settings-add" type="button"><Pencil /> จัดการเนื้อหา</button></section><section className="settings-card"><h2>การใช้สิทธิ์หน้าร้าน</h2><div className="settings-switch-title"><Switch checked={settings.inStoreEnabled} onChange={() => update("inStoreEnabled", !settings.inStoreEnabled)} label="ใช้สิทธิ์หน้าร้าน" /> แจ้งให้ลูกค้าใช้สิทธิ์ที่หน้าร้าน</div><label className="wide-label">ข้อความสำหรับหน้าการใช้สิทธิ์<textarea defaultValue="กรุณาใช้สิทธิ์ที่หน้าร้านและแสดงหน้านี้ให้พนักงาน" /></label><label className="wide-label">การยืนยันแลกรางวัล<select value={settings.requireRedemptionApproval ? "approve" : "auto"} onChange={(event) => update("requireRedemptionApproval", event.target.value === "approve")}><option value="approve">ให้พนักงานยืนยันก่อน</option><option value="auto">ยืนยันอัตโนมัติ</option></select></label></section><section className="settings-card content-types"><h2>การแสดงผลสิทธิพิเศษ</h2>{["คูปอง", "ของรางวัล", "ข่าวสาร"].map((item) => <label key={item}><span><Gift /> {item}</span><Switch checked={true} onChange={() => undefined} label={item} /></label>)}</section></div><div className="settings-column"><PhonePreview settings={settings} mode="popup" /><section className="settings-card"><h2>ลูกค้าจะเห็นอะไรบ้าง</h2>{["Popup หนึ่งครั้งหลัง Login", "กดดูรายละเอียดก่อนใช้สิทธิ์", "แจ้งเตือนให้ใช้ที่หน้าร้าน"].map((item) => <div className="feature-row" key={item}><Bell /><span><strong>{item}</strong><small>ข้อมูลสิทธิพิเศษที่ชัดเจนสำหรับลูกค้า</small></span></div>)}</section></div></div>;
}

function TeamTab({ settings, update, team, setTeam, addTeamMember }: { settings: AppSettings; update: Update; team: TeamMember[]; setTeam: React.Dispatch<React.SetStateAction<TeamMember[]>>; addTeamMember: () => void }) {
  return <div className="settings-grid"><div className="settings-column"><section className="settings-card"><div className="card-heading"><div><h2>บัญชีทีมงาน</h2><p>กำหนดผู้ที่สามารถเข้าใช้งานระบบหลังบ้าน</p></div><button className="settings-add compact" type="button" onClick={addTeamMember}><UserPlus /> เพิ่มทีมงาน</button></div><div className="team-list">{team.map((member) => <div key={member.id}><span className="team-avatar">{member.name[0]}</span><span><strong>{member.name}</strong><small>{member.email}</small></span><select value={member.role} onChange={(event) => setTeam((current) => current.map((item) => item.id === member.id ? { ...item, role: event.target.value as TeamMember["role"] } : item))}><option>ผู้ดูแลระบบ</option><option>ผู้จัดการร้าน</option><option>พนักงาน</option></select><button type="button"><Pencil /> จัดการสิทธิ์</button><Switch checked={member.active} onChange={() => setTeam((current) => current.map((item) => item.id === member.id ? { ...item, active: !item.active } : item))} label={member.name} /></div>)}</div></section><section className="settings-card"><h2>สิทธิ์การใช้งานตามบทบาท</h2><div className="permission-table"><div><b>เมนู</b><b>ผู้ดูแลระบบ</b><b>ผู้จัดการร้าน</b><b>พนักงาน</b></div>{["ให้แต้ม", "สมาชิก", "คูปองและของรางวัล", "ตั้งค่าระบบ"].map((item, index) => <div key={item}><span>{item}</span><Check /><Check />{index === 0 ? <Check /> : <i>−</i>}</div>)}</div></section><section className="settings-card"><h2>นโยบายรหัสผ่าน</h2><div className="settings-inline"><label>นโยบายรหัสผ่าน<select><option>รหัสผ่านอย่างน้อย 6 ตัวอักษร</option><option>รหัสผ่านที่รัดกุม</option></select></label><label>ให้พนักงานเปลี่ยนรหัสผ่านเอง <Switch checked={true} onChange={() => undefined} label="เปลี่ยนรหัสผ่านเอง" /></label></div></section></div><div className="settings-column"><section className="settings-card"><h2>ความปลอดภัยของระบบ</h2><SecurityRow icon={<LockKeyhole />} title="ยืนยันตัวตนสองขั้นตอน" text="เพิ่มความปลอดภัยด้วยการยืนยันตัวตน 2 ขั้นตอน" checked={settings.twoFactorEnabled} toggle={() => update("twoFactorEnabled", !settings.twoFactorEnabled)} /><SecurityRow icon={<Bell />} title="แจ้งเตือนเมื่อมีการเข้าสู่ระบบใหม่" text="แจ้งเตือนจากอุปกรณ์หรือสถานที่ใหม่" checked={settings.loginAlertsEnabled} toggle={() => update("loginAlertsEnabled", !settings.loginAlertsEnabled)} /><SecurityRow icon={<Clock3 />} title="ออกจากระบบอัตโนมัติเมื่อไม่ใช้งาน" text="ลดความเสี่ยงเมื่อไม่มีการใช้งาน" checked={settings.autoLogoutEnabled} toggle={() => update("autoLogoutEnabled", !settings.autoLogoutEnabled)}><select value={settings.autoLogoutMinutes} onChange={(event) => update("autoLogoutMinutes", Number(event.target.value))}><option value="15">15 นาที</option><option value="30">30 นาที</option><option value="60">60 นาที</option></select></SecurityRow></section><section className="settings-card"><h2>ประวัติการเข้าใช้งานล่าสุด</h2>{team.map((member, index) => <div className="login-row" key={member.id}><span className="team-avatar">{member.name[0]}</span><span><strong>{member.name}</strong><small>{index === 2 ? "Safari • iPhone • เชียงใหม่" : "Chrome • Windows • กรุงเทพฯ"}</small></span><i /> <small>{index === 2 ? "เมื่อวาน 18:30" : `วันนี้ 0${9 + index}:15`}</small></div>)}</section><div className="security-banner"><ShieldCheck /><span><strong>ข้อมูลสมาชิกได้รับการปกป้อง</strong><small>เราดูแลข้อมูลของคุณตามมาตรฐานสากล</small></span></div></div></div>;
}

function SecurityRow({ icon, title, text, checked, toggle, children }: { icon: React.ReactNode; title: string; text: string; checked: boolean; toggle: () => void; children?: React.ReactNode }) {
  return <div className="security-row"><span className="security-icon">{icon}</span><span><strong>{title}</strong><small>{text}</small></span>{children}<Switch checked={checked} onChange={toggle} label={title} /></div>;
}

function PhonePreview({ settings, mode }: { settings: AppSettings; mode: "login" | "member" | "card" | "popup" }) {
  return <section className="settings-card phone-card"><h2>{mode === "login" ? "ตัวอย่างหน้า Login บนมือถือ" : mode === "popup" ? "ตัวอย่าง Popup สำหรับลูกค้า" : "ตัวอย่างผลลัพธ์สำหรับสมาชิก"}</h2><div className="phone-shell"><div className="phone-notch" /><div className="phone-brand"><PawPrint /><b>TAMMY</b><Bell /></div>{mode === "login" ? <><Image src="/assets/member-mascot-cat.png" alt="" width={130} height={130} /><strong>{settings.shopName}</strong><p>{settings.welcomeMessage}</p><input placeholder="เบอร์โทรศัพท์" /><input placeholder="รหัสผ่าน" /><button style={{ background: settings.primaryColor }}>เข้าสู่ระบบ</button></> : <><div className="member-card-preview" style={{ background: `linear-gradient(135deg, ${settings.primaryColor}33, #fff2d8)` }}><Image src="/assets/member-mascot-cat.png" alt="" width={105} height={105} /><span><b>คุณภาณต์</b><strong>2,480 แต้ม</strong><em>Gold</em></span></div>{mode === "popup" ? <div className="phone-popup"><b>โปรพิเศษประจำเดือน</b><Image src="/assets/tammy-logo-cat.png" alt="" width={95} height={85} /><p>อร่อย สุขภาพดี เพื่อน้องที่คุณรัก</p><button style={{ background: settings.primaryColor }}>ถัดไป</button></div> : <div className="progress-preview"><span>อีก 2,520 แต้ม จะเลื่อนเป็น Platinum</span><i><b style={{ width: "48%", background: settings.primaryColor }} /></i></div>}</>}</div></section>;
}

function SettingsPreview({ tab, settings, close }: { tab: Tab; settings: AppSettings; close: () => void }) {
  return <div className="preview-modal settings-preview-modal" role="dialog" aria-modal="true"><button className="preview-backdrop" type="button" onClick={close} aria-label="ปิด" /><section><button className="preview-close" type="button" onClick={close}><X /></button><span className="preview-kicker">ตัวอย่างการตั้งค่า</span><h2>{tabs.find((item) => item.id === tab)?.label}</h2><div className="preview-settings-card" style={{ borderColor: settings.primaryColor }}><Image src="/assets/tammy-logo-cat.png" alt="" width={90} height={80} /><div><strong>{settings.shopName}</strong><p>{settings.description}</p><span style={{ background: settings.primaryColor }}>สีหลักของระบบ</span></div></div><button className="preview-redeem" type="button" onClick={close}>ปิดตัวอย่าง</button></section></div>;
}
