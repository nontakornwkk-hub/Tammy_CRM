"use client";

import Image from "next/image";
import {
  Bell,
  Check,
  ChevronDown,
  Clock3,
  Crown,
  Eye,
  ExternalLink,
  Gift,
  GripVertical,
  ImageIcon,
  LockKeyhole,
  Menu,
  Move,
  Palette,
  PawPrint,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Smartphone,
  Store,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
  ZoomIn,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { SiFacebook, SiInstagram, SiLine, SiTiktok, SiYoutube } from "react-icons/si";
import { AppSettings, ContactPlatform, defaultSettings, loadSettings, saveSettings } from "@/lib/settings";
import { Sidebar } from "./sidebar";

type Tab = "shop" | "points" | "card" | "content" | "team";
type TeamMember = { id: number; name: string; email: string; role: "ผู้ดูแลระบบ" | "ผู้จัดการร้าน" | "พนักงาน"; active: boolean };
type Rank = { id: number; name: string; minimum: number; color: string; active: boolean };

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

const initialRanks: Rank[] = [
  { id: 1, name: "Silver", minimum: 0, color: "#aeb7c4", active: true },
  { id: 2, name: "Gold", minimum: 5000, color: "#ffbd3f", active: true },
  { id: 3, name: "Platinum", minimum: 20000, color: "#9a68df", active: true },
];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return <button type="button" className={`toggle${checked ? " on" : ""}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>;
}

export function SettingsManager() {
  const [activeTab, setActiveTab] = useState<Tab>("shop");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [team, setTeam] = useState(initialTeam);
  const [ranks, setRanks] = useState(initialRanks);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  useEffect(() => setSettings(loadSettings()), []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setSaved(false);
  }

  function persist() {
    saveSettings(settings);
    setDirty(false);
    setSaved(true);
  }

  function addTeamMember() {
    setTeam((current) => [...current, { id: Date.now(), name: "สมาชิกใหม่", email: "new@tammy.com", role: "พนักงาน", active: true }]);
    setDirty(true);
  }

  function addRank() {
    setRanks((current) => [...current, { id: Date.now(), name: "แรงค์ใหม่", minimum: 30000, color: "#5da9ee", active: true }]);
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
          <div className="header-actions"><span className={`save-state${dirty ? " dirty" : ""}`}><i /> {dirty ? "ยังไม่ได้บันทึก" : "บันทึกแล้ว"}</span><button className="button outline" type="button" onClick={() => setPreviewOpen(true)}><Eye size={19} /> ดูตัวอย่าง</button><button className="button primary" type="button" onClick={persist}><Save size={19} /> {saved ? "บันทึกการตั้งค่า" : "บันทึกการเปลี่ยนแปลง"}</button></div>
        </header>

        <nav className="settings-tabs" aria-label="หมวดการตั้งค่า">
          {tabs.map((tab) => <button type="button" key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
        </nav>

        {activeTab === "shop" ? <ShopTab settings={settings} update={update} /> : null}
        {activeTab === "points" ? <PointsTab settings={settings} update={update} ranks={ranks} setRanks={setRanks} addRank={addRank} /> : null}
        {activeTab === "card" ? <CardTab settings={settings} update={update} /> : null}
        {activeTab === "content" ? <ContentTab settings={settings} update={update} /> : null}
        {activeTab === "team" ? <TeamTab settings={settings} update={update} team={team} setTeam={setTeam} addTeamMember={addTeamMember} /> : null}

        {previewOpen ? <SettingsPreview tab={activeTab} settings={settings} close={() => setPreviewOpen(false)} /> : null}
      </main>
    </div>
  );
}

type Update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;

function ShopTab({ settings, update }: { settings: AppSettings; update: Update }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [imageStatus, setImageStatus] = useState("");

  async function readImage(file: File | undefined, key: "logoDataUrl" | "heroDataUrl") {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      window.alert("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      return;
    }
    setImageStatus(file.size > 3_000_000 ? "กำลังบีบอัดรูปภาพ…" : "กำลังอ่านรูปภาพ…");
    try {
      const result = file.size > 3_000_000 ? await compressImage(file) : await fileToDataUrl(file);
      update(key, result.dataUrl);
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

  return <div className="settings-grid shop-settings-grid">
    <div className="settings-column">
      <section className="settings-card">
        <h2>โลโก้และข้อมูลร้าน</h2>
        <div className="shop-profile">
          <div className="logo-uploader">
            <DraggableImage className="logo-preview" src={settings.logoDataUrl || "/assets/tammy-logo-cat.png"} alt="ตัวอย่างโลโก้ร้าน" x={settings.logoPositionX} y={settings.logoPositionY} zoom={settings.logoZoom} unoptimized={Boolean(settings.logoDataUrl)} setPosition={(x, y) => { update("logoPositionX", x); update("logoPositionY", y); }} setZoom={(zoom) => update("logoZoom", zoom)} />
            <label><Upload size={17} /> เปลี่ยนโลโก้<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImage(event.target.files?.[0], "logoDataUrl")} /></label>
            {settings.logoDataUrl ? <button className="clear-image" type="button" onClick={() => update("logoDataUrl", "")}><Trash2 size={14} /> ใช้โลโก้เริ่มต้น</button> : null}
            <small>รองรับ PNG, JPG, WEBP • เกิน 5MB จะบีบอัดอัตโนมัติ</small>
          </div>
          <div className="settings-fields">
            <label>ชื่อร้าน<input value={settings.shopName} onChange={(event) => update("shopName", event.target.value)} /></label>
            <label>ชื่อภาษาอังกฤษ<input value={settings.shopNameEn} onChange={(event) => update("shopNameEn", event.target.value)} /></label>
            <label>คำอธิบายร้าน<textarea value={settings.description} onChange={(event) => update("description", event.target.value)} /></label>
            <label>ข้อความต้อนรับ<textarea value={settings.welcomeMessage} onChange={(event) => update("welcomeMessage", event.target.value)} /></label>
          </div>
        </div>

        <div className="login-image-editor">
          <div className="section-heading"><div><h3>รูปภาพหน้า Login</h3><small>ลากภาพเพื่อจัดตำแหน่งและซูมเพื่อครอบได้อิสระ</small></div><label className="image-action"><ImageIcon /> เปลี่ยนรูปภาพ<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => readImage(event.target.files?.[0], "heroDataUrl")} /></label></div>
          {settings.heroDataUrl ? <DraggableImage className="hero-position-preview" src={settings.heroDataUrl} alt="ตัวอย่างรูปหน้า Login" x={settings.heroPositionX} y={settings.heroPositionY} zoom={settings.heroZoom} unoptimized setPosition={(x, y) => { update("heroPositionX", x); update("heroPositionY", y); }} setZoom={(zoom) => update("heroZoom", zoom)} /> : <div className="hero-position-preview empty"><ImageIcon /><span>อัปโหลดรูปเพื่อดูตัวอย่าง</span></div>}
          {settings.heroDataUrl ? <button className="clear-image" type="button" onClick={() => update("heroDataUrl", "")}><Trash2 size={14} /> ลบรูปภาพ</button> : null}
          {imageStatus ? <p className="image-status" aria-live="polite">{imageStatus}</p> : null}
        </div>
      </section>
    </div>

    <div className="settings-column">
      <section className="settings-card">
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
      <section className="settings-card store-hours-card">
        <div className="card-heading"><div><h2>เวลาเปิด–ปิดร้าน</h2><p>กำหนดเวลาที่จะแสดงให้ลูกค้าเห็น</p></div><Switch checked={settings.storeHoursEnabled} onChange={() => update("storeHoursEnabled", !settings.storeHoursEnabled)} label="เปิดแสดงเวลาทำการ" /></div>
        <div className="store-hours-fields"><label>วันที่เปิดให้บริการ<select value={settings.storeDays} onChange={(event) => update("storeDays", event.target.value)}><option>ทุกวัน</option><option>จันทร์ – ศุกร์</option><option>จันทร์ – เสาร์</option><option>เสาร์ – อาทิตย์</option></select></label><label>เวลาเปิด<input type="time" value={settings.storeOpenTime} onChange={(event) => update("storeOpenTime", event.target.value)} /></label><label>เวลาปิด<input type="time" value={settings.storeCloseTime} onChange={(event) => update("storeCloseTime", event.target.value)} /></label></div>
        {settings.storeHoursEnabled ? <div className="store-hours-preview"><Clock3 /><span><strong>{settings.storeDays}</strong> เปิด {settings.storeOpenTime} – {settings.storeCloseTime} น.</span></div> : <div className="store-hours-preview closed"><Clock3 /><span>ปิดการแสดงเวลาทำการ</span></div>}
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

function DraggableImage({ className, src, alt, x, y, zoom, unoptimized, setPosition, setZoom }: { className: string; src: string; alt: string; x: number; y: number; zoom: number; unoptimized?: boolean; setPosition: (x: number, y: number) => void; setZoom: (zoom: number) => void }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function move(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current || !frameRef.current) return;
    const rect = frameRef.current.getBoundingClientRect();
    setPosition(Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))), Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))));
  }

  return <div className="crop-editor"><div ref={frameRef} className={`draggable-image ${className}`} onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={move} onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}><Image src={src} alt={alt} fill unoptimized={unoptimized} draggable={false} style={{ objectFit: "cover", objectPosition: `${x}% ${y}%`, transform: `scale(${zoom})` }} /><span className="drag-hint"><Move size={15} /> ลากภาพเพื่อจัดตำแหน่ง</span></div><label className="zoom-control"><ZoomIn size={15} /><span>ซูม</span><input aria-label="ซูมรูปภาพ" type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /><b>{Math.round(zoom * 100)}%</b></label></div>;
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

function PointsTab({ settings, update, ranks, setRanks, addRank }: { settings: AppSettings; update: Update; ranks: Rank[]; setRanks: React.Dispatch<React.SetStateAction<Rank[]>>; addRank: () => void }) {
  return <div className="settings-grid">
    <div className="settings-column">
      <section className="settings-card"><h2>กฎการสะสมแต้ม</h2><p>กำหนดอัตราแต้มที่สมาชิกได้รับจากยอดซื้อ</p><div className="points-rule"><span>ทุกยอดซื้อ</span><input type="number" min="1" value={settings.pointsSpend} onChange={(event) => update("pointsSpend", Math.max(1, Number(event.target.value)))} /><span>บาท</span><b>→</b><span>ได้รับ</span><input type="number" min="1" value={settings.pointsEarned} onChange={(event) => update("pointsEarned", Math.max(1, Number(event.target.value)))} /><span>แต้ม</span></div><div className="settings-inline"><label>อายุแต้ม<select value={settings.pointsExpiration} onChange={(event) => update("pointsExpiration", event.target.value)}><option>ไม่มีวันหมดอายุ</option><option>12 เดือน</option><option>24 เดือน</option></select></label><label>ตัวคูณโปรโมชั่น <input className="compact-number" type="number" min="1" value={settings.promotionMultiplier} onChange={(event) => update("promotionMultiplier", Math.max(1, Number(event.target.value)))} /></label><label>เปิดการสะสมแต้ม <Switch checked={settings.accumulationEnabled} onChange={() => update("accumulationEnabled", !settings.accumulationEnabled)} label="เปิดการสะสมแต้ม" /></label></div></section>
      <section className="settings-card"><h2>แรงค์สมาชิก</h2><p>จัดระดับสมาชิกตามยอดซื้อสะสม</p><div className="rank-list">{ranks.map((rank) => <div className="rank-row" key={rank.id}><span className="rank-medal" style={{ color: rank.color }}><Crown /></span><i style={{ background: rank.color }} /><strong>{rank.name}</strong><span>ขั้นต่ำ</span><input type="number" value={rank.minimum} onChange={(event) => setRanks((current) => current.map((item) => item.id === rank.id ? { ...item, minimum: Number(event.target.value) } : item))} /><span>บาท</span><GripVertical /><Switch checked={rank.active} onChange={() => setRanks((current) => current.map((item) => item.id === rank.id ? { ...item, active: !item.active } : item))} label={rank.name} /></div>)}</div><button className="settings-add" type="button" onClick={addRank}><Plus /> เพิ่มแรงค์</button></section>
      <section className="settings-card reset-card"><Crown /><div><strong>ตั้งค่าการรีแรงค์</strong><small>กำหนดรอบการรีแรงค์และการปรับระดับสมาชิก</small></div><select><option>ทุก 12 เดือน • วันที่ 31 ธันวาคม</option><option>ไม่รีเซ็ตแรงค์</option></select><label>เปิดการรีแรงค์อัตโนมัติ <Switch checked={true} onChange={() => undefined} label="รีแรงค์อัตโนมัติ" /></label></section>
    </div>
    <div className="settings-column"><PhonePreview settings={settings} mode="member" /><section className="settings-card"><h2>สิ่งที่ลูกค้าจะเห็น</h2>{[["แต้มสะสมปัจจุบัน", "แสดงจำนวนแต้มที่มีอยู่ในบัญชี"], ["ระดับสมาชิก", "แสดงสถานะระดับปัจจุบันของสมาชิก"], ["แต้มที่ต้องใช้เพื่อเลื่อนแรงค์", "แสดงความคืบหน้าไปยังระดับถัดไป"]].map(([title, text], index) => <div className="feature-row" key={title}><span className={`feature-icon f${index}`}>{index === 0 ? "★" : index === 1 ? "♛" : "↗"}</span><span><strong>{title}</strong><small>{text}</small></span></div>)}</section></div>
  </div>;
}

function CardTab({ settings, update }: { settings: AppSettings; update: Update }) {
  const themes = [["Coral Sunset", "#ff786a", "#ffd49c"], ["Mint Garden", "#74d9b7", "#d8f7ed"], ["Sky Blue", "#6aa6f4", "#d7eaff"], ["Lavender Dream", "#a66be4", "#eddcff"]];
  const mascots = [["Tammy Cat", "🐱"], ["Happy Dog", "🐶"], ["Mochi Cat", "😺"], ["Paw", "🐾"]];
  return <div className="settings-grid"><div className="settings-column"><section className="settings-card"><h2>ธีมบัตรสมาชิก</h2><p>เพิ่มและจัดการธีมที่สมาชิกเลือกใช้ได้</p><div className="theme-grid">{themes.map(([name, from, to]) => <button type="button" key={name} className={settings.selectedTheme === name ? "selected" : ""} onClick={() => update("selectedTheme", name)}><span style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>{settings.selectedTheme === name ? <Check /> : null}</span><strong>{name}</strong><Switch checked={true} onChange={() => undefined} label={name} /></button>)}</div><button className="settings-add" type="button"><Plus /> เพิ่มธีมสี</button></section><section className="settings-card"><h2>มาสคอตจากร้าน</h2><p>เลือกรูปที่ลูกค้าใช้ตกแต่งบัตร</p><div className="mascot-grid">{mascots.map(([name, icon]) => <button type="button" key={name} className={settings.selectedMascot === name ? "selected" : ""} onClick={() => update("selectedMascot", name)}><span>{icon}</span><strong>{name}</strong><Switch checked={true} onChange={() => undefined} label={name} /></button>)}</div></section><section className="settings-card display-toggle"><div><h2>การแสดงผลในบัตร</h2><p>อนุญาตให้สมาชิกเลือกธีมและมาสคอตเอง</p></div><Switch checked={settings.displayCustomization} onChange={() => update("displayCustomization", !settings.displayCustomization)} label="ปรับแต่งบัตร" /></section></div><div className="settings-column"><PhonePreview settings={settings} mode="card" /><section className="settings-card"><h2>ลูกค้าสามารถทำอะไรได้บ้าง</h2>{["เลือกสีบัตร", "เลือกมาสคอต", "บันทึกการตกแต่ง"].map((item) => <div className="feature-row" key={item}><Palette /><span><strong>{item}</strong><small>ปรับแต่งและบันทึกบัตรสมาชิกได้ทันที</small></span></div>)}</section></div></div>;
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
  return <section className="settings-card phone-card"><h2>{mode === "login" ? "ตัวอย่างหน้า Login บนมือถือ" : mode === "popup" ? "ตัวอย่าง Popup สำหรับลูกค้า" : "ตัวอย่างผลลัพธ์สำหรับสมาชิก"}</h2><div className="phone-shell"><div className="phone-notch" /><div className="phone-brand"><PawPrint /><b>TAMMY</b><Bell /></div>{mode === "login" ? <><Image src="/assets/tammy-sidebar-cat.png" alt="" width={130} height={130} /><strong>{settings.shopName}</strong><p>{settings.welcomeMessage}</p><input placeholder="เบอร์โทรศัพท์" /><input placeholder="รหัสผ่าน" /><button style={{ background: settings.primaryColor }}>เข้าสู่ระบบ</button></> : <><div className="member-card-preview" style={{ background: `linear-gradient(135deg, ${settings.primaryColor}33, #fff2d8)` }}><Image src="/assets/tammy-sidebar-cat.png" alt="" width={105} height={105} /><span><b>คุณภาณต์</b><strong>2,480 แต้ม</strong><em>Gold</em></span></div>{mode === "popup" ? <div className="phone-popup"><b>โปรพิเศษประจำเดือน</b><Image src="/assets/tammy-logo-cat.png" alt="" width={95} height={85} /><p>อร่อย สุขภาพดี เพื่อน้องที่คุณรัก</p><button style={{ background: settings.primaryColor }}>ถัดไป</button></div> : <div className="progress-preview"><span>อีก 2,520 แต้ม จะเลื่อนเป็น Platinum</span><i><b style={{ width: "48%", background: settings.primaryColor }} /></i></div>}</>}</div></section>;
}

function SettingsPreview({ tab, settings, close }: { tab: Tab; settings: AppSettings; close: () => void }) {
  return <div className="preview-modal settings-preview-modal" role="dialog" aria-modal="true"><button className="preview-backdrop" type="button" onClick={close} aria-label="ปิด" /><section><button className="preview-close" type="button" onClick={close}><X /></button><span className="preview-kicker">ตัวอย่างการตั้งค่า</span><h2>{tabs.find((item) => item.id === tab)?.label}</h2><div className="preview-settings-card" style={{ borderColor: settings.primaryColor }}><Image src="/assets/tammy-logo-cat.png" alt="" width={90} height={80} /><div><strong>{settings.shopName}</strong><p>{settings.description}</p><span style={{ background: settings.primaryColor }}>สีหลักของระบบ</span></div></div><button className="preview-redeem" type="button" onClick={close}>ปิดตัวอย่าง</button></section></div>;
}
