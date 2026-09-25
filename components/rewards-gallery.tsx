"use client";

import Image from "next/image";
import { Check, ChevronDown, Gift, ImageIcon, Menu, Megaphone, Package, Pencil, Plus, RotateCcw, Search, Star, Tag, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { refreshPublishedPopupContent } from "@/lib/popup-content";
import { DateRangePicker } from "./date-range-picker";
import { Sidebar } from "./sidebar";

type Kind = "rewards" | "coupons" | "news";
type View = Kind | "promotions";
type CatalogItem = {
  id: string; kind: Kind; title: string; description: string; category: string; imageUrl: string | null;
  imageUrls: string[]; createdAt: string | null; expiresAt: string | null;
  active: boolean; points: number; stock: number | null; startsAt: string | null; endsAt: string | null;
  code: string; discountType: string; discountValue: number; minSpend: number; usageLimit: number | null;
  content: string;
};
type DatabaseRow = Record<string, unknown>;
type SelectOption = { value: string; label: string };

function CuteSelect({ label, value, options, onChange, name }: { label: string; value: string; options: SelectOption[]; onChange: (value: string) => void; name?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);
  const selected = options.find((option) => option.value === value);
  return <div className={`cute-select${open ? " is-open" : ""}`} ref={root}>
    {name ? <input type="hidden" name={name} value={value} /> : null}
    <button type="button" className="cute-select-trigger" aria-label={`${label}: ${selected?.label || value}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}><span>{selected?.label || value}</span><ChevronDown size={17} /></button>
    {open ? <div className="cute-select-menu" role="listbox" aria-label={label} onKeyDown={(event) => { if (event.key === "Escape") { setOpen(false); root.current?.querySelector<HTMLButtonElement>(".cute-select-trigger")?.focus(); } if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button")); const index = buttons.indexOf(document.activeElement as HTMLButtonElement); buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus(); } }}>{options.map((option) => <button type="button" role="option" aria-selected={value === option.value} className={value === option.value ? "is-selected" : ""} key={option.value} onClick={() => { onChange(option.value); setOpen(false); root.current?.querySelector<HTMLButtonElement>(".cute-select-trigger")?.focus(); }}><span>{option.label}</span>{value === option.value ? <Check size={16} /> : null}</button>)}</div> : null}
  </div>;
}
const tabs: { kind: Kind; title: string; icon: typeof Gift }[] = [
  { kind: "rewards", title: "ของรางวัล", icon: Gift },
  { kind: "coupons", title: "คูปอง", icon: Tag },
  { kind: "news", title: "ข่าวสาร", icon: Megaphone },
];
const navigationTabs: { view: View; title: string; icon: typeof Gift }[] = [
  { view: "rewards", title: "ของรางวัล", icon: Gift },
  { view: "coupons", title: "คูปอง", icon: Tag },
  { view: "promotions", title: "โปรโมชั่น", icon: Star },
  { view: "news", title: "ข่าวสาร", icon: Megaphone },
];
const empty = (kind: Kind): CatalogItem => ({
  id: "", kind, title: "", description: "", category: tabs.find((tab) => tab.kind === kind)?.title || "",
  imageUrl: null, imageUrls: [], createdAt: null, expiresAt: null, active: true, points: 0, stock: null, startsAt: null, endsAt: null,
  code: "", discountType: "percent", discountValue: 10, minSpend: 0, usageLimit: null, content: "",
});
const value = (row: DatabaseRow, key: string) => String(row[key] ?? "");
const numberOr = (row: DatabaseRow, key: string, fallback = 0) => Number(row[key] ?? fallback);
function fromRow(kind: Kind, row: DatabaseRow): CatalogItem {
  return {
    id: value(row, "id"), kind, title: value(row, "title"),
    description: value(row, kind === "news" ? "summary" : "description"),
    category: value(row, "category") || tabs.find((tab) => tab.kind === kind)?.title || "",
    imageUrl: row.image_url ? value(row, "image_url") : null,
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls.filter((url): url is string => typeof url === "string") : row.image_url ? [value(row, "image_url")] : [],
    createdAt: row.created_at ? value(row, "created_at") : null,
    expiresAt: row.expires_at ? value(row, "expires_at") : null,
    active: kind === "news" ? row.status === "published" : row.active === true,
    points: numberOr(row, "points_cost"),
    stock: row.stock == null ? null : numberOr(row, "stock"),
    startsAt: row.starts_at ? value(row, "starts_at") : null,
    endsAt: row.ends_at ? value(row, "ends_at") : null,
    code: value(row, "code"), discountType: value(row, "discount_type") || "percent",
    discountValue: numberOr(row, "discount_value"), minSpend: numberOr(row, "min_spend"),
    usageLimit: row.usage_limit == null ? null : numberOr(row, "usage_limit"),
    content: value(row, "content"),
  };
}
function atStart(value: string) { return value ? new Date(`${value}T00:00:00+07:00`).toISOString() : null; }
function atEnd(value: string) { return value ? new Date(`${value}T23:59:59+07:00`).toISOString() : null; }
async function withinFiveMb(file: File): Promise<File> {
  if (file.size <= 5 * 1024 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.82, 0.68, 0.54]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= 5 * 1024 * 1024) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  }
  throw new Error("บีบอัดภาพให้ต่ำกว่า 5 MB ไม่สำเร็จ กรุณาเลือกภาพอื่น");
}

async function cropSquareImage(file: File, position: { x: number; y: number }): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width === bitmap.height) return file;
    const side = Math.min(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = Math.min(side, 1800);
    const x = Math.round((bitmap.width - side) * position.x);
    const y = Math.round((bitmap.height - side) * position.y);
    canvas.getContext("2d")?.drawImage(bitmap, x, y, side, side, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
    if (!blob) throw new Error("ครอบรูปภาพไม่สำเร็จ");
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } finally { bitmap.close(); }
}

async function compressNewsImage(file: File): Promise<File> {
  const limit = 1.8 * 1024 * 1024;
  if (file.size <= limit) return file;
  const bitmap = await createImageBitmap(file);
  try {
    for (const maxSide of [2400, 2000, 1600, 1200, 900, 700]) {
      const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.84, 0.7, 0.55, 0.4]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
        if (blob && blob.size <= limit) return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
  } finally { bitmap.close(); }
  throw new Error(`บีบอัดรูป ${file.name} ให้ไม่เกิน 2 MB ไม่สำเร็จ`);
}

export function RewardsGallery() {
  const [view, setView] = useState<View>("rewards");
  const kind: Kind = view === "promotions" ? "news" : view;
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ทั้งหมด");
  const [category, setCategory] = useState("ทั้งหมด");
  const [formCategory, setFormCategory] = useState("ข่าวสาร");
  const [formDiscountType, setFormDiscountType] = useState("percent");
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState("");
  const [cropPosition, setCropPosition] = useState({ x: 0.5, y: 0.5 });
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const cropDrag = useRef<{ x: number; y: number; position: { x: number; y: number } } | null>(null);
  const cropMoved = useRef(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const [newsImages, setNewsImages] = useState<{ url: string; file?: File }[]>([]);
  const [editingRange, setEditingRange] = useState({ start: "", end: "" });
  const [saving, setSaving] = useState(false);
  const toggleQueues = useRef(new Map<string, Promise<void>>());
  const desiredStatuses = useRef(new Map<string, boolean>());
  const [mobileMenu, setMobileMenu] = useState(false);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client) { setError("ยังไม่ได้ตั้งค่า Supabase"); setLoading(false); return; }
    setLoading(true); setError("");
    const results = await Promise.all(tabs.map(async ({ kind: table }) => {
      const result = await client.from(table).select("*").order("created_at", { ascending: false }).order("id", { ascending: true });
      return { table, result };
    }));
    const firstError = results.find(({ result }) => result.error)?.result.error;
    if (firstError) setError(firstError.message);
    else setItems(results.flatMap(({ table, result }) => (result.data || []).map((row) => fromRow(table, row as DatabaseRow))));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const matchesView = (item: CatalogItem) => item.kind === kind && (kind !== "news" || (view === "promotions") === (item.category === "โปรโมชั่น"));
  const categories = [...new Set(items.filter(matchesView).map((item) => item.category))];
  const visible = useMemo(() => items.filter((item) =>
    item.kind === kind &&
    (kind !== "news" || (view === "promotions") === (item.category === "โปรโมชั่น")) &&
    (status === "ทั้งหมด" || (status === "เปิดใช้งาน" ? item.active : !item.active)) &&
    (category === "ทั้งหมด" || item.category === category) &&
    `${item.title} ${item.description} ${item.category}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  ), [items, kind, view, status, category, search]);
  const activeTab = navigationTabs.find((tab) => tab.view === view)!;

  function clearNewsPreviews() { newsImages.forEach(image => { if (image.file) URL.revokeObjectURL(image.url); }); }
  function openEditor(item: CatalogItem) { clearNewsPreviews(); setEditing(item); setFormCategory(item.category === "โปรโมชั่น" ? "โปรโมชั่น" : "ข่าวสาร"); setFormDiscountType(item.discountType); setEditingRange({ start: item.startsAt?.slice(0, 10) || "", end: (item.kind === "news" ? item.expiresAt : item.endsAt)?.slice(0, 10) || "" }); setNewsImages((item.imageUrls.length ? item.imageUrls : item.imageUrl ? [item.imageUrl] : []).map(url => ({ url }))); setFile(null); setFilePreview(""); setCropPosition({ x: 0.5, y: 0.5 }); setError(""); }
  function closeEditor() { if (!saving) { clearNewsPreviews(); setEditing(null); setNewsImages([]); setFile(null); setFilePreview(""); } }
  function selectNewsFiles(files: FileList | null) {
    if (!files?.length) return;
    const chosen = Array.from(files);
    if (newsImages.length + chosen.length > 10) { setError("ข่าวสารใส่รูปได้สูงสุด 10 รูป"); return; }
    if (chosen.some(file => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError("รองรับ JPG, PNG และ WEBP เท่านั้น"); return; }
    setError("");
    setNewsImages(current => [...current, ...chosen.map(file => ({ url: URL.createObjectURL(file), file }))]);
  }
  async function save(form: FormData) {
    if (!supabase || !editing) return;
    const title = String(form.get("title") || "").trim();
    if (!title) { setError("กรุณาใส่ชื่อรายการ"); return; }
    setSaving(true); setError("");
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) throw new Error("กรุณาเข้าสู่ระบบก่อนบันทึก");
      let imageUrl = editing.imageUrl;
      if (file) {
        const upload = await withinFiveMb(await cropSquareImage(file, cropPosition));
        const path = `${auth.user.id}/${crypto.randomUUID()}.${upload.type === "image/png" ? "png" : upload.type === "image/webp" ? "webp" : "jpg"}`;
        const uploaded = await supabase.storage.from("crm-content").upload(path, upload, { contentType: upload.type, upsert: false });
        if (uploaded.error) throw uploaded.error;
        imageUrl = supabase.storage.from("crm-content").getPublicUrl(path).data.publicUrl;
      }
      let imageUrls = newsImages.map(image => image.url);
      if (editing.kind === "news") {
        imageUrls = await Promise.all(newsImages.map(async image => {
          if (!image.file) return image.url;
          const compressed = await compressNewsImage(image.file);
          const path = `${auth.user.id}/news-${crypto.randomUUID()}.${compressed.type === "image/jpeg" ? "jpg" : compressed.type === "image/png" ? "png" : "webp"}`;
          const uploaded = await supabase!.storage.from("crm-content").upload(path, compressed, { contentType: compressed.type, upsert: false });
          if (uploaded.error) throw uploaded.error;
          return supabase!.storage.from("crm-content").getPublicUrl(path).data.publicUrl;
        }));
        imageUrl = imageUrls[0] || null;
      }
      const shared = { title, category: String(form.get("category") || activeTab.title).trim(), image_url: imageUrl };
      let payload: DatabaseRow;
      if (editing.kind === "rewards") payload = { ...shared, description: String(form.get("description") || ""), points_cost: Number(form.get("points") || 0), stock: form.get("stock") === "" ? null : Number(form.get("stock")), active: form.get("active") === "on", starts_at: atStart(String(form.get("startsAt") || "")), ends_at: atEnd(String(form.get("endsAt") || "")) };
      else if (editing.kind === "coupons") payload = { ...shared, description: String(form.get("description") || ""), code: String(form.get("code") || "").trim().toUpperCase(), discount_type: String(form.get("discountType") || "percent"), discount_value: Number(form.get("discountValue") || 0), min_spend: Number(form.get("minSpend") || 0), usage_limit: form.get("usageLimit") === "" ? null : Number(form.get("usageLimit")), active: form.get("active") === "on", starts_at: atStart(String(form.get("startsAt") || "")), ends_at: atEnd(String(form.get("endsAt") || "")) };
      else {
        const startsOn = String(form.get("startsAt") || "");
        const endsOn = String(form.get("expiresAt") || "");
        if (startsOn && endsOn && endsOn < startsOn) throw new Error("วันสิ้นสุดโปรต้องไม่ก่อนวันเริ่มโปร");
        payload = { ...shared, image_urls: imageUrls, summary: String(form.get("description") || ""), content: String(form.get("content") || ""), starts_at: atStart(startsOn), expires_at: atEnd(endsOn), status: form.get("active") === "on" ? "published" : "draft", published_at: form.get("active") === "on" ? new Date().toISOString() : null };
      }
      if (editing.kind === "coupons" && !payload.code) throw new Error("กรุณาใส่รหัสคูปอง");
      const result = editing.id
        ? await supabase.from(editing.kind).update(payload).eq("id", editing.id).select().single()
        : await supabase.from(editing.kind).insert({ ...payload, owner_id: auth.user.id }).select().single();
      if (result.error) throw result.error;
      try { await refreshPublishedPopupContent(); } catch { setError("บันทึกรายการแล้ว แต่ปรับ Popup ไม่สำเร็จ กรุณาบันทึกหน้าตั้งค่า Popup อีกครั้ง"); }
      clearNewsPreviews(); setEditing(null); setNewsImages([]); setFile(null); setFilePreview("");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ"); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!supabase || !editing?.id || !window.confirm(`ลบ "${editing.title}" ใช่ไหม?`)) return;
    setSaving(true); setError("");
    const { error: deleteError } = await supabase.from(editing.kind).delete().eq("id", editing.id);
    setSaving(false);
    if (deleteError) { setError(deleteError.message); return; }
    try { await refreshPublishedPopupContent(); } catch { setError("ลบรายการแล้ว แต่ปรับ Popup ไม่สำเร็จ กรุณาบันทึกหน้าตั้งค่า Popup อีกครั้ง"); }
    clearNewsPreviews(); setNewsImages([]); setEditing(null); await load();
  }
  function toggleActive(item: CatalogItem) {
    const client = supabase;
    if (!client) return;
    const key = `${item.kind}:${item.id}`;
    const next = !(desiredStatuses.current.get(key) ?? item.active);
    desiredStatuses.current.set(key, next);
    setError("");
    setItems((current) => current.map((entry) => entry.id === item.id && entry.kind === item.kind ? { ...entry, active: next } : entry));
    const previous = toggleQueues.current.get(key) ?? Promise.resolve();
    const request = previous.catch(() => undefined).then(async () => {
      const payload = item.kind === "news"
        ? { status: next ? "published" : "draft", published_at: next ? new Date().toISOString() : null }
        : { active: next };
      const { data, error: updateError } = await client.from(item.kind).update(payload).eq("id", item.id).select().single();
      if (updateError || !data) throw updateError || new Error("เปลี่ยนสถานะไม่สำเร็จ");
      try { await refreshPublishedPopupContent(); } catch { setError("เปลี่ยนสถานะแล้ว แต่ปรับ Popup ไม่สำเร็จ กรุณาบันทึกหน้าตั้งค่า Popup อีกครั้ง"); }
    });
    toggleQueues.current.set(key, request);
    void request.catch((cause) => {
      if (desiredStatuses.current.get(key) === next) {
        desiredStatuses.current.set(key, !next);
        setItems((current) => current.map((entry) => entry.id === item.id && entry.kind === item.kind ? { ...entry, active: !next } : entry));
      }
      setError(cause instanceof Error ? cause.message : "เปลี่ยนสถานะไม่สำเร็จ");
    }).finally(() => {
      if (toggleQueues.current.get(key) === request) {
        toggleQueues.current.delete(key);
        desiredStatuses.current.delete(key);
      }
    });
  }
  async function selectFile(next: File | undefined) {
    if (!next) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type)) { setError("รองรับ JPG, PNG และ WEBP เท่านั้น"); return; }
    const bitmap = await createImageBitmap(next);
    setImageSize({ width: bitmap.width, height: bitmap.height });
    bitmap.close();
    setCropPosition({ x: 0.5, y: 0.5 });
    setFile(next);
    const reader = new FileReader();
    reader.onload = () => setFilePreview(String(reader.result || ""));
    reader.readAsDataURL(next);
  }

  function dragCrop(event: React.PointerEvent<HTMLButtonElement>) {
    if (!cropDrag.current || !file) return;
    if (Math.abs(event.clientX - cropDrag.current.x) > 4 || Math.abs(event.clientY - cropDrag.current.y) > 4) cropMoved.current = true;
    const previewSize = event.currentTarget.getBoundingClientRect().width;
    const overflowX = previewSize * Math.max(0, imageSize.width / imageSize.height - 1);
    const overflowY = previewSize * Math.max(0, imageSize.height / imageSize.width - 1);
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    setCropPosition({
      x: overflowX ? clamp(cropDrag.current.position.x - (event.clientX - cropDrag.current.x) / overflowX) : 0.5,
      y: overflowY ? clamp(cropDrag.current.position.y - (event.clientY - cropDrag.current.y) / overflowY) : 0.5,
    });
  }

  return <div className="app-shell rewards-gallery-page">
    <div className={`mobile-overlay${mobileMenu ? " show" : ""}`} onClick={() => setMobileMenu(false)} />
    <div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/rewards" /></div>
    <main className="main-content rewards-gallery-main">
      <header className="page-header rewards-gallery-header">
        <button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button>
        <div className="title-icon"><Gift /></div><div className="heading-copy"><h1>คูปอง ของรางวัล และข่าวสาร</h1><p>สร้างและจัดการเนื้อหาที่ลูกค้าจะเห็น</p></div>
        <div className="header-actions"><button className="button primary" type="button" onClick={() => openEditor({ ...empty(kind), category: view === "promotions" ? "โปรโมชั่น" : empty(kind).category })}><Plus size={19} /> เพิ่มรายการ</button></div>
      </header>
      <nav className="reward-tabs rewards-gallery-tabs" aria-label="ประเภทเนื้อหา">{navigationTabs.map(({ view: tab, title, icon: Icon }) => <button key={tab} type="button" className={`${view === tab ? "active " : ""}is-${tab}`} onClick={() => { setView(tab); setCategory("ทั้งหมด"); setStatus("ทั้งหมด"); setSearch(""); }}><Icon /> {title}</button>)}</nav>
      <div className="rewards-gallery-toolbar">
        <label className="search-box"><Search size={20} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`ค้นหา${activeTab.title}...`} /></label>
        <div className="cute-select-field toolbar-select"><span>สถานะ</span><CuteSelect label="สถานะ" value={status} onChange={setStatus} options={[{ value: "ทั้งหมด", label: "ทั้งหมด" }, { value: "เปิดใช้งาน", label: "เปิดใช้งาน" }, { value: "ปิดใช้งาน", label: "ปิดใช้งาน" }]} /></div>
        <div className="cute-select-field toolbar-select"><span>หมวดหมู่</span><CuteSelect label="หมวดหมู่" value={category} onChange={setCategory} options={[{ value: "ทั้งหมด", label: "ทั้งหมด" }, ...categories.map((name) => ({ value: name, label: name }))]} /></div>
        <button className="rewards-gallery-reset" type="button" onClick={() => { setSearch(""); setStatus("ทั้งหมด"); setCategory("ทั้งหมด"); }}><RotateCcw size={16} /> ล้างตัวกรอง</button>
      </div>
      {error && !editing ? <p className="rewards-gallery-error" role="alert">{error} <button type="button" onClick={() => void load()}>ลองอีกครั้ง</button></p> : null}
      {loading ? <p className="rewards-gallery-empty">กำลังโหลดข้อมูล...</p> : visible.length ? <div className="rewards-gallery-grid">{visible.map((item) => <article className="rewards-gallery-card" key={item.id}>
        <div className="rewards-gallery-image">{item.imageUrl ? <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw" unoptimized /> : <span><ImageIcon size={42} /><small>ยังไม่มีภาพพรีวิว</small></span>}</div>
        <div className="rewards-gallery-copy"><h2>{item.title}</h2><span className={`rewards-gallery-category${item.kind === "news" ? item.category === "โปรโมชั่น" ? " is-promotion" : " is-news" : ""}`}>{item.category}</span><p>{item.description || "ยังไม่มีคำอธิบาย"}</p>
          <div className="rewards-gallery-facts">{item.kind === "rewards" ? <><strong><Star size={15} /> ใช้ {item.points.toLocaleString()} แต้ม</strong><span><Package size={15} /> คงเหลือ {item.stock === null ? "ไม่จำกัด" : `${item.stock} ชิ้น`}</span></> : item.kind === "coupons" ? <><strong>{item.discountType === "percent" ? `ลด ${item.discountValue}%` : `ลด ฿${item.discountValue.toLocaleString()}`}</strong><span>รหัส {item.code}</span></> : <><strong>{item.category}</strong><span>{item.active ? item.category === "โปรโมชั่น" && item.startsAt && Date.parse(item.startsAt) > Date.now() ? "ประกาศล่วงหน้า · ยังไม่เริ่มโปร" : "เผยแพร่แล้ว" : "แบบร่าง"}</span></>}</div>
          <div className="rewards-gallery-actions"><button className={`rewards-gallery-status rewards-gallery-toggle ${item.active ? "on" : "off"}`} type="button" role="switch" aria-checked={item.active} aria-label={`${item.active ? "ปิด" : "เปิด"}${item.kind === "news" ? item.category : tabs.find((tab) => tab.kind === item.kind)?.title} ${item.title}`} title={item.active ? "เปิดใช้งาน" : "ปิดใช้งาน"} onClick={() => toggleActive(item)}><span className="switch-track" aria-hidden="true"><i /></span></button><button type="button" onClick={() => openEditor(item)}><Pencil size={17} /> แก้ไข</button></div>
        </div>
      </article>)}</div> : !loading ? <div className="rewards-gallery-empty"><ImageIcon size={36} /><strong>ยังไม่มี{activeTab.title}</strong><span>กด “เพิ่มรายการ” เพื่อสร้างรายการแรก</span></div> : null}
    </main>
    {editing ? <div className="preview-modal rewards-gallery-modal" role="dialog" aria-modal="true" aria-label={editing.id ? `แก้ไข${editing.title}` : `เพิ่ม${activeTab.title}`}>
      <button className="preview-backdrop" type="button" onClick={closeEditor} aria-label="ปิด" />
      <section><button className="preview-close" type="button" onClick={closeEditor} aria-label="ปิด"><X /></button><h2>{editing.id ? `แก้ไข${activeTab.title}` : `เพิ่ม${activeTab.title}`}</h2>
        <form action={save} key={editing.id || editing.kind}>
          {editing.kind === "news" ? <div className="news-gallery-field"><div className="news-gallery-heading"><strong>รูปภาพข่าวสาร</strong><span>{newsImages.length} / 10 รูป</span></div><p>รูปแรกเป็นภาพปก · เลือกได้ครั้งละหลายรูป · ระบบย่อภาพให้ไม่เกินประมาณ 2 MB ต่อรูป</p><div className="news-gallery-grid">{newsImages.map((image, index) => <div className="news-gallery-tile" key={image.url}><Image src={image.url} alt={`ภาพข่าว ${index + 1}`} fill sizes="120px" unoptimized />{index === 0 ? <span>ภาพปก</span> : null}<button type="button" aria-label={`ลบรูปที่ ${index + 1}`} onClick={() => { if (image.file) URL.revokeObjectURL(image.url); setNewsImages(current => current.filter(entry => entry !== image)); }}><X size={15}/></button></div>)}{newsImages.length < 10 ? <label className="news-gallery-add"><Plus size={24}/><span>เพิ่มรูป</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { selectNewsFiles(event.target.files); event.target.value = ""; }}/></label> : null}</div></div> : <div className="rewards-gallery-upload-field"><span>ภาพรายการ</span><div className="rewards-gallery-upload"><button type="button" className={`rewards-gallery-crop-preview${file && imageSize.width !== imageSize.height ? " is-draggable" : ""}`} aria-label={filePreview || editing.imageUrl ? "คลิกเพื่อเปลี่ยนรูปภาพ" : "คลิกเพื่อเลือกรูปภาพ"} onClick={() => { if (!cropMoved.current) imageInput.current?.click(); cropMoved.current = false; }} onPointerDown={event => { cropMoved.current = false; if (!file || imageSize.width === imageSize.height) return; cropDrag.current = { x: event.clientX, y: event.clientY, position: cropPosition }; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={dragCrop} onPointerUp={() => { cropDrag.current = null; }} onPointerCancel={() => { cropDrag.current = null; cropMoved.current = false; }}>{filePreview || editing.imageUrl ? <Image src={filePreview || editing.imageUrl!} alt="ภาพครอบ 1:1" fill sizes="250px" unoptimized style={{ objectPosition: `${cropPosition.x * 100}% ${cropPosition.y * 100}%` }} draggable={false} /> : <><ImageIcon /><span>คลิกเพื่อเพิ่มภาพ 1:1</span></>}</button><small className="rewards-gallery-upload-hint">คลิกภาพเพื่อ{filePreview || editing.imageUrl ? "เปลี่ยน" : "เลือก"}รูป · JPG, PNG, WEBP · ไม่เกิน 5 MB<br />{file && imageSize.width !== imageSize.height ? "ลากภาพเพื่อจัดตำแหน่งครอบ 1:1" : "ภาพขนาดอื่นจะครอบเป็น 1:1 อัตโนมัติ"}</small><input ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="เลือกรูปภาพ" onChange={(event) => { void selectFile(event.target.files?.[0]); event.target.value = ""; }} /></div></div>}
          <div className="rewards-gallery-form-row rewards-gallery-basic"><label>ชื่อรายการ<input name="title" defaultValue={editing.title} required /></label>{editing.kind === "news" ? <div className="cute-select-field"><span>ประเภท</span><CuteSelect label="ประเภท" name="category" value={formCategory} onChange={setFormCategory} options={[{ value: "ข่าวสาร", label: "ข่าวสาร" }, { value: "โปรโมชั่น", label: "โปรโมชั่น" }]} /></div> : <label>หมวดหมู่<input name="category" defaultValue={editing.category} required /></label>}</div>
          <label>คำอธิบาย<textarea name="description" defaultValue={editing.description} rows={3} /></label>
          {editing.kind === "rewards" ? <div className="rewards-gallery-form-row"><label>แต้มที่ใช้แลก<input name="points" type="number" min="0" defaultValue={editing.points} required /></label><label>จำนวนคงเหลือ<input name="stock" type="number" min="0" defaultValue={editing.stock ?? ""} placeholder="ไม่จำกัด" /></label></div> : null}
          {editing.kind === "coupons" ? <><label>รหัสคูปอง<input name="code" defaultValue={editing.code} required /></label><div className="rewards-gallery-form-row"><div className="cute-select-field"><span>ประเภทส่วนลด</span><CuteSelect label="ประเภทส่วนลด" name="discountType" value={formDiscountType} onChange={setFormDiscountType} options={[{ value: "percent", label: "เปอร์เซ็นต์" }, { value: "fixed", label: "จำนวนเงิน" }]} /></div><label>มูลค่าส่วนลด<input name="discountValue" type="number" min="0" defaultValue={editing.discountValue} required /></label></div><div className="rewards-gallery-form-row"><label>ยอดขั้นต่ำ<input name="minSpend" type="number" min="0" defaultValue={editing.minSpend} /></label><label>จำกัดจำนวนใช้<input name="usageLimit" type="number" min="0" defaultValue={editing.usageLimit ?? ""} placeholder="ไม่จำกัด" /></label></div></> : null}
          {editing.kind === "news" ? <><label>เนื้อหา<textarea name="content" defaultValue={editing.content} rows={5} /></label><label>ช่วงวันเริ่ม–สิ้นสุดโปร (ถ้ามี)<DateRangePicker start={editingRange.start} end={editingRange.end} onChange={(start, end) => setEditingRange({ start, end })} nameStart="startsAt" nameEnd="expiresAt" label="ช่วงวันที่โปรโมชั่น" /></label><p className="news-schedule-hint">ต้องการแจ้งโปรล่วงหน้า? เปิดเผยแพร่ตอนนี้ แล้วเลือกวันเริ่มโปรในอนาคต ลูกค้าจะเห็นประกาศ “เร็ว ๆ นี้” ก่อนโปรเริ่ม · ข่าวทั่วไปเว้นวันที่ได้</p></> : <label>ช่วงวันที่ใช้งาน<DateRangePicker start={editingRange.start} end={editingRange.end} onChange={(start, end) => setEditingRange({ start, end })} nameStart="startsAt" nameEnd="endsAt" /></label>}
          <label className="rewards-gallery-checkbox"><input name="active" type="checkbox" role="switch" defaultChecked={editing.active} /> {editing.kind === "news" ? "เผยแพร่ข่าวสาร" : "เปิดใช้งาน"}</label>
          {error ? <p className="rewards-gallery-error" role="alert">{error}</p> : null}
          <div className="rewards-gallery-form-actions">{editing.id ? <button className="delete" type="button" onClick={() => void remove()} disabled={saving}><Trash2 size={17} /> ลบ</button> : null}<button type="button" onClick={closeEditor} disabled={saving}>ยกเลิก</button><button className="primary" type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button></div>
        </form>
      </section>
    </div> : null}
  </div>;
}
