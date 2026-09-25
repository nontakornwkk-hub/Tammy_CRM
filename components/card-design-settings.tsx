"use client";

import Image from "next/image";
import { Bone, Check, CircleDot, Fish, ImagePlus, Palette, PawPrint, Pencil, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { useState } from "react";
import type { AppSettings } from "@/lib/settings";
import { paletteFromTone, patternForTheme, type CardMascot, type CardPattern, type CardTheme } from "@/lib/card-design";
import { MemberCard, type CardMember } from "./member-card";

type Update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
type ThemeDraft = { id?: string; name: string; base: string; pattern: CardPattern };
type MascotDraft = { id?: string; name: string; image: string };

const tones = [
  { name: "คอรัล", color: "#eb8177" }, { name: "มิ้นต์", color: "#75bda5" },
  { name: "ฟ้า", color: "#79a9df" }, { name: "ลาเวนเดอร์", color: "#aa8bd8" },
  { name: "ฮันนี่", color: "#d7a64f" }, { name: "ชมพู", color: "#dd8eb0" },
];
const patterns = [
  { id: "paws", name: "อุ้งเท้า", Icon: PawPrint },
  { id: "fish", name: "ก้างปลา", Icon: Fish },
  { id: "kibble", name: "เม็ดอาหาร", Icon: CircleDot },
  { id: "stitch", name: "รอยเย็บ", Icon: Sparkles },
  { id: "bones", name: "กระดูก", Icon: Bone },
] as const;

function isImageSource(value: string) { return /^(\/|https?:|data:image\/)/i.test(value); }

function readImage(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("อ่านไฟล์ภาพไม่สำเร็จ")));
    reader.readAsDataURL(file);
  });
}

async function mascotImageData(file: File): Promise<{ image: string; compressed: boolean; size: number }> {
  if (file.size <= 3_000_000) return { image: await readImage(file), compressed: false, size: file.size };
  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    let quality = 0.9;
    for (let attempt = 0; attempt < 9; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("อุปกรณ์นี้ไม่รองรับการบีบอัดภาพ");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (blob?.type === "image/webp" && blob.size <= 3_000_000) return { image: await readImage(blob), compressed: true, size: blob.size };
      scale *= 0.83;
      quality = Math.max(0.48, quality - 0.06);
    }
    throw new Error("บีบอัดให้ไม่เกิน 3 MB ไม่สำเร็จ กรุณาลองภาพอื่น");
  } finally {
    bitmap.close();
  }
}

export function CardDesignSettings({ settings, update }: { settings: AppSettings; update: Update }) {
  const [previewTier, setPreviewTier] = useState<CardMember["level"]>("Gold");
  const [themeDraft, setThemeDraft] = useState<ThemeDraft | null>(null);
  const [mascotDraft, setMascotDraft] = useState<MascotDraft | null>(null);
  const [mascotBusy, setMascotBusy] = useState(false);
  const [mascotNotice, setMascotNotice] = useState("");
  const [mascotError, setMascotError] = useState("");

  const design = { themes: settings.cardThemes, mascots: settings.cardMascots, selectedTheme: settings.selectedTheme, selectedMascot: settings.selectedMascot, displayCustomization: settings.displayCustomization };
  const liveTheme: CardTheme | null = themeDraft ? { id: themeDraft.id ?? "card-draft", name: themeDraft.name || "ธีมใหม่", ...paletteFromTone(themeDraft.base), pattern: themeDraft.pattern } : null;
  const liveDesign = liveTheme ? { ...design, themes: [...design.themes.filter((item) => item.id !== liveTheme.id), liveTheme], selectedTheme: liveTheme.id } : design;
  const preview: CardMember = { name: "คุณอาทิตย์", code: "TM000123", level: previewTier, points: 2480, spending: previewTier === "Member" ? 1500 : previewTier === "Gold" ? 12500 : 23500 };

  function editTheme(theme?: CardTheme) {
    setThemeDraft(theme ? { id: theme.id, name: theme.name, base: theme.base ?? theme.from, pattern: patternForTheme(theme) } : { name: "", base: tones[0].color, pattern: "paws" });
  }
  function saveTheme() {
    if (!themeDraft?.name.trim()) return;
    const id = themeDraft.id ?? crypto.randomUUID();
    const theme: CardTheme = { id, name: themeDraft.name.trim(), ...paletteFromTone(themeDraft.base), pattern: themeDraft.pattern };
    update("cardThemes", themeDraft.id ? settings.cardThemes.map((item) => item.id === id ? theme : item) : [...settings.cardThemes, theme]);
    update("selectedTheme", id);
    setThemeDraft(null);
  }
  function removeTheme(id: string) {
    if (settings.cardThemes.length < 2) return;
    const remaining = settings.cardThemes.filter((item) => item.id !== id);
    update("cardThemes", remaining);
    if (settings.selectedTheme === id) update("selectedTheme", remaining[0].id);
    if (themeDraft?.id === id) setThemeDraft(null);
  }
  function editMascot(mascot?: CardMascot) {
    setMascotDraft(mascot ? { ...mascot } : { name: "", image: "" });
    setMascotError(""); setMascotNotice("");
  }
  async function uploadMascot(file?: File) {
    if (!file || !mascotDraft) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setMascotError("รองรับเฉพาะ PNG, JPG และ WEBP"); return; }
    setMascotBusy(true); setMascotError("");
    setMascotNotice(file.size > 3_000_000 ? "กำลังบีบอัดภาพให้ไม่เกิน 3 MB…" : "กำลังเตรียมภาพ…");
    try {
      const result = await mascotImageData(file);
      setMascotDraft((current) => current ? { ...current, image: result.image } : current);
      setMascotNotice(result.compressed ? `บีบอัดสำเร็จ เหลือ ${(result.size / 1_000_000).toFixed(1)} MB` : `พร้อมใช้งาน ${(result.size / 1_000_000).toFixed(1)} MB`);
    } catch (error) {
      setMascotError(error instanceof Error ? error.message : "ไม่สามารถอ่านภาพนี้ได้");
      setMascotNotice("");
    } finally {
      setMascotBusy(false);
    }
  }
  function saveMascot() {
    if (!mascotDraft?.name.trim() || !mascotDraft.image.trim() || mascotBusy) return;
    const id = mascotDraft.id ?? crypto.randomUUID();
    const mascot = { id, name: mascotDraft.name.trim(), image: mascotDraft.image.trim() };
    update("cardMascots", mascotDraft.id ? settings.cardMascots.map((item) => item.id === id ? mascot : item) : [...settings.cardMascots, mascot]);
    update("selectedMascot", id);
    setMascotDraft(null);
  }
  function removeMascot(id: string) {
    update("cardMascots", settings.cardMascots.filter((item) => item.id !== id));
    if (settings.selectedMascot === id) update("selectedMascot", "");
    if (mascotDraft?.id === id) setMascotDraft(null);
  }

  return <div className="settings-grid card-design-grid">
    <div className="settings-column">
      <section className="settings-card card-design-section"><div className="card-heading"><div><h2>ธีมบัตรสมาชิก</h2><p>เลือกลายสำเร็จรูป หรือสร้างธีมจากโทนสีของร้าน</p></div></div>
        <div className="card-theme-grid">{settings.cardThemes.map((theme) => <div className={`card-theme-option${settings.selectedTheme === theme.id ? " selected" : ""}`} key={theme.id}>
          <button type="button" className="card-theme-select" onClick={() => { update("selectedTheme", theme.id); setThemeDraft(null); }} aria-pressed={settings.selectedTheme === theme.id}>
            <span className={`card-theme-mini pattern-${patternForTheme(theme)}`} style={{ background: `linear-gradient(120deg, ${theme.from}, ${theme.to})`, color: theme.ink }}><PawPrint size={16}/><b>TAMMY</b><em>2,480 แต้ม</em>{settings.selectedTheme === theme.id ? <Check className="card-choice-check" size={17}/> : null}</span><strong>{theme.name}</strong>
          </button><div className="card-option-actions"><button type="button" onClick={() => editTheme(theme)} aria-label={`แก้ไขธีม ${theme.name}`} title="แก้ไขธีม"><Pencil size={15}/></button><button type="button" disabled={settings.cardThemes.length < 2} onClick={() => removeTheme(theme.id)} aria-label={`ลบธีม ${theme.name}`} title="ลบธีม"><Trash2 size={15}/></button></div>
        </div>)}</div>
        {themeDraft ? <div className="card-editor" aria-label={themeDraft.id ? "แก้ไขธีมบัตร" : "เพิ่มธีมบัตร"}>
          <div className="card-editor-head"><span className="card-editor-icon"><Palette size={20}/></span><div><h3>{themeDraft.id ? "แก้ไขธีมบัตร" : "สร้างธีมบัตรใหม่"}</h3><p>เลือกสีเดียว ระบบจะจัดคู่สีและสีข้อความให้อัตโนมัติ</p></div><button type="button" onClick={() => setThemeDraft(null)} aria-label="ปิดตัวแก้ไขธีม"><X size={18}/></button></div>
          <label className="card-editor-name">ชื่อธีม<input value={themeDraft.name} maxLength={28} placeholder="เช่น พีชพาสเทล" onChange={(event) => setThemeDraft({ ...themeDraft, name: event.target.value })}/></label>
          <div className="card-editor-label">เลือกโทนสี</div><div className="card-tone-row">{tones.map((tone) => <button key={tone.name} type="button" className={themeDraft.base.toLowerCase() === tone.color ? "active" : ""} onClick={() => setThemeDraft({ ...themeDraft, base: tone.color })} aria-label={`โทน${tone.name}`} aria-pressed={themeDraft.base.toLowerCase() === tone.color}><i style={{ background: tone.color }}/><span>{tone.name}</span></button>)}<label className="card-tone-custom" title="เลือกสีเอง"><input type="color" value={themeDraft.base} onChange={(event) => setThemeDraft({ ...themeDraft, base: event.target.value })}/><span>เลือกเอง</span></label></div>
          <div className="card-editor-label">ลายพื้นหลัง</div><div className="card-pattern-row">{patterns.map(({ id, name, Icon }) => <button key={id} type="button" className={themeDraft.pattern === id ? "active" : ""} onClick={() => setThemeDraft({ ...themeDraft, pattern: id })} aria-pressed={themeDraft.pattern === id}><Icon size={19}/><span>{name}</span></button>)}</div>
          <div className="card-gradient-preview"><span>ตัวอย่างสีที่ระบบสร้าง</span><i style={{ background: `linear-gradient(120deg, ${paletteFromTone(themeDraft.base).from}, ${paletteFromTone(themeDraft.base).to})`, color: paletteFromTone(themeDraft.base).ink }}><PawPrint size={18}/> TAMMY <b>2,480 แต้ม</b></i></div>
          <div className="card-editor-actions"><button type="button" className="card-editor-save" disabled={!themeDraft.name.trim()} onClick={saveTheme}>{themeDraft.id ? "บันทึกธีม" : "เพิ่มธีม"}</button><button type="button" onClick={() => setThemeDraft(null)}>ยกเลิก</button></div>
        </div> : <button className="settings-add card-add-trigger" type="button" onClick={() => editTheme()}><Plus size={17}/> เพิ่มธีมบัตร</button>}
      </section>
      <section className="settings-card card-design-section"><div className="card-heading"><div><h2>มาสคอตบนบัตร</h2><p>เลือก 1 ตัวหรือไม่แสดง · ไม่เปลี่ยนโลโก้ร้าน</p></div></div>
        <div className="card-mascot-grid"><button type="button" className={`card-mascot-option${!settings.selectedMascot ? " selected" : ""}`} onClick={() => update("selectedMascot", "")} aria-pressed={!settings.selectedMascot}><span>✦</span><strong>ไม่แสดง</strong></button>{settings.cardMascots.map((mascot) => <div className={`card-mascot-option${settings.selectedMascot === mascot.id ? " selected" : ""}`} key={mascot.id}><button type="button" onClick={() => update("selectedMascot", mascot.id)} aria-pressed={settings.selectedMascot === mascot.id}><span>{isImageSource(mascot.image) ? <Image src={mascot.image} alt="" width={64} height={64} unoptimized={mascot.image.startsWith("data:") || mascot.image.startsWith("http")}/> : mascot.image}</span><strong>{mascot.name}</strong></button><div className="card-mascot-actions"><button type="button" onClick={() => editMascot(mascot)} aria-label={`แก้ไขมาสคอต ${mascot.name}`}><Pencil size={13}/></button><button type="button" onClick={() => removeMascot(mascot.id)} aria-label={`ลบมาสคอต ${mascot.name}`}><Trash2 size={13}/></button></div></div>)}</div>
        {mascotDraft ? <div className="card-editor mascot-editor" aria-label={mascotDraft.id ? "แก้ไขมาสคอต" : "เพิ่มมาสคอต"}>
          <div className="card-editor-head"><span className="card-editor-icon"><ImagePlus size={20}/></span><div><h3>{mascotDraft.id ? "แก้ไขมาสคอต" : "เพิ่มมาสคอตใหม่"}</h3><p>ใช้ภาพพื้นหลังโปร่งใสเพื่อให้เข้ากับทุกสีบัตร</p></div><button type="button" onClick={() => setMascotDraft(null)} aria-label="ปิดตัวแก้ไขมาสคอต"><X size={18}/></button></div>
          <div className="mascot-editor-body"><label className="mascot-dropzone"><span className="mascot-dropzone-preview">{mascotDraft.image ? isImageSource(mascotDraft.image) ? <Image src={mascotDraft.image} alt="ตัวอย่างมาสคอต" width={110} height={110} unoptimized={mascotDraft.image.startsWith("data:") || mascotDraft.image.startsWith("http")}/> : mascotDraft.image : <Upload size={28}/>}</span><strong>{mascotDraft.image ? "เปลี่ยนรูปภาพ" : "เลือกภาพมาสคอต"}</strong><small>PNG, JPG, WEBP · เกิน 3 MB บีบอัดอัตโนมัติ</small><input type="file" accept="image/png,image/jpeg,image/webp" disabled={mascotBusy} onChange={(event) => { void uploadMascot(event.target.files?.[0]); event.target.value = ""; }}/></label><div className="mascot-editor-fields"><label className="card-editor-name">ชื่อมาสคอต<input value={mascotDraft.name} maxLength={28} placeholder="เช่น ทาโก้" onChange={(event) => setMascotDraft({ ...mascotDraft, name: event.target.value })}/></label><label className="card-editor-name">หรือใช้อีโมจิแทนภาพ<input value={isImageSource(mascotDraft.image) ? "" : mascotDraft.image} maxLength={8} placeholder="เช่น 🐾" onChange={(event) => { setMascotDraft({ ...mascotDraft, image: event.target.value }); setMascotNotice(""); }}/></label><p className="mascot-editor-hint">รูปหรืออีโมจิจะแสดงบนบัตรเท่านั้น ไม่กระทบโลโก้ร้าน</p></div></div>
          {mascotNotice ? <p className="mascot-upload-note" aria-live="polite">{mascotNotice}</p> : null}{mascotError ? <p className="mascot-upload-error" role="alert">{mascotError}</p> : null}
          <div className="card-editor-actions"><button type="button" className="card-editor-save" disabled={mascotBusy || !mascotDraft.name.trim() || !mascotDraft.image.trim()} onClick={saveMascot}>{mascotDraft.id ? "บันทึกมาสคอต" : "เพิ่มมาสคอต"}</button><button type="button" onClick={() => setMascotDraft(null)}>ยกเลิก</button></div>
        </div> : <button className="settings-add card-add-trigger" type="button" onClick={() => editMascot()}><Plus size={17}/> เพิ่มมาสคอต</button>}
      </section>
    </div>
    <div className="settings-column"><section className="settings-card card-live-preview"><div className="card-heading"><div><h2>ตัวอย่างบัตรสำหรับสมาชิก</h2><p>ขนาดบัตรเท่าเดิม · แตะบัตรเพื่อพลิกดู QR</p></div></div><div className="card-rank-tabs" role="group" aria-label="เลือกระดับสมาชิกตัวอย่าง">{(["Member", "Gold", "Platinum"] as const).map((tier) => <button type="button" key={tier} className={previewTier === tier ? "active" : ""} onClick={() => setPreviewTier(tier)} aria-pressed={previewTier === tier}>{tier}</button>)}</div><MemberCard design={liveDesign} member={preview} shopName={settings.shopNameEn || settings.shopName} goldThreshold={settings.goldMinSpend} platinumThreshold={settings.platinumMinSpend} /></section><p className="card-public-note">ธีมและมาสคอตที่บันทึกจะแสดงบนบัตรลูกค้าด้วย</p></div>
  </div>;
}
