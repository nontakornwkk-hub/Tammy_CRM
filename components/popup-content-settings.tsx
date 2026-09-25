"use client";

import Image from "next/image";
import { GripVertical, Megaphone, Plus, Tag, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AppSettings } from "@/lib/settings";
import { loadPopupCatalog, popupKey, resolvePopupContent, type PopupCatalog, type PopupContent, type PopupDisplay } from "@/lib/popup-content";
import { PopupCarouselCard } from "./customer-popup-carousel";
import { PopupDetailView } from "./customer-content-detail";

type Update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
const emptyCatalog: PopupCatalog = { news: [], coupons: [] };

function PopupImage({ item, size }: { item: PopupDisplay; size: number }) {
  return item.image ? <Image src={item.image} alt="" width={size} height={size} unoptimized /> : item.source === "news" ? <Megaphone size={size / 2} /> : <Tag size={size / 2} />;
}

export function PopupContentSettings({ settings, update }: { settings: AppSettings; update: Update }) {
  const items = settings.popupContent;
  const [catalog, setCatalog] = useState<PopupCatalog>(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [previewDetails, setPreviewDetails] = useState(false);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    let current = true;
    loadPopupCatalog().then(value => { if (current) setCatalog(value); })
      .catch(reason => { if (current) setError(reason instanceof Error ? reason.message : "โหลดข่าวสารและคูปองไม่สำเร็จ"); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  const available = resolvePopupContent([
    ...catalog.news.map(row => ({ id: row.id, source: "news" as const, active: true })),
    ...catalog.coupons.map(row => ({ id: row.id, source: "coupons" as const, active: true })),
  ], catalog);
  const displayItems = resolvePopupContent(items, catalog);
  const enabled = settings.popupEnabled ? displayItems.filter(item => item.active) : [];
  const previewItems = enabled.length ? enabled : displayItems;
  const selected = previewItems.find(item => popupKey(item) === selectedId) ?? previewItems[0];
  const index = selected ? previewItems.findIndex(item => popupKey(item) === popupKey(selected)) : 0;
  const unselected = available.filter(item => !items.some(entry => popupKey(entry) === popupKey(item)));

  function change(list: PopupContent[]) { update("popupContent", list); }
  function choose(id: string) { setSelectedId(id); setPreviewDetails(false); setShowPreview(true); }
  function move(id: string, target: string) {
    if (id === target) return;
    const from = items.findIndex(item => popupKey(item) === id);
    const to = items.findIndex(item => popupKey(item) === target);
    if (from < 0 || to < 0) return;
    const next = [...items];
    next.splice(to, 0, next.splice(from, 1)[0]);
    change(next);
  }

  return <div className="settings-grid popup-settings-grid">
    <div className="settings-column">
      <section className="settings-card">
        <div className="popup-heading"><div><h2>Popup หลัง Login</h2><p>เลือกข่าวสารหรือคูปองที่มีอยู่เพื่อแสดงให้ลูกค้า</p></div><label className="popup-master"><input type="checkbox" role="switch" checked={settings.popupEnabled} onChange={event => update("popupEnabled", event.target.checked)} /> เปิดใช้งาน</label></div>
        <p className="popup-info">เปิดอยู่ {enabled.length} รายการ · ลากเพื่อเรียงลำดับที่ลูกค้าจะเห็น</p>
        {loading ? <p>กำลังโหลดข่าวสารและคูปอง…</p> : null}
        {error ? <p role="alert">{error}</p> : null}
        <div className="popup-editor-list">{displayItems.map((item, order) => <div className={`popup-editor-row${selected && popupKey(selected) === popupKey(item) ? " selected" : ""}`} key={popupKey(item)} draggable onDragStart={() => { dragId.current = popupKey(item); }} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragId.current) move(dragId.current, popupKey(item)); dragId.current = null; }} onDragEnd={() => { dragId.current = null; }}>
          <GripVertical aria-hidden="true" /><span className="popup-order">{order + 1}</span>
          <button className="popup-row-image" type="button" onClick={() => choose(popupKey(item))} aria-label={`ดูตัวอย่าง ${item.title}`}><PopupImage item={item} size={46} /></button>
          <button className="popup-row-copy" type="button" onClick={() => choose(popupKey(item))}><span className="popup-row-kind">{item.category}</span><strong>{item.title}</strong><small>{item.summary || "กดเพื่อดูตัวอย่างบนมือถือ"}</small></button>
          <label className={`popup-row-toggle ${item.active ? "is-on" : "is-off"}`}><input type="checkbox" role="switch" checked={item.active} aria-label={`${item.active ? "ปิด" : "เปิด"} ${item.title}`} onChange={event => change(items.map(entry => popupKey(entry) === popupKey(item) ? { ...entry, active: event.target.checked } : entry))} /><span>{item.active ? "เปิด" : "ปิด"}</span></label>
          <button className="popup-row-delete" type="button" onClick={() => change(items.filter(entry => popupKey(entry) !== popupKey(item)))} aria-label={`นำ ${item.title} ออกจาก Popup`}><Trash2 size={16}/></button>
        </div>)}</div>
        {!loading && !displayItems.length ? <p className="popup-empty">ยังไม่ได้เลือกรายการ</p> : null}
        <button className="popup-add" type="button" onClick={() => setAdding(value => !value)}><Plus size={18}/> เลือกจากข่าวสาร/คูปอง</button>
        {adding ? <div className="popup-source-list">{unselected.length ? unselected.map(item => <button type="button" key={popupKey(item)} onClick={() => { change([...items, { id: item.id, source: item.source, active: true }]); choose(popupKey(item)); setAdding(false); }}><span className="popup-row-image"><PopupImage item={item} size={42} /></span><span><strong>{item.title}</strong><small>{item.category} · {item.summary}</small></span><Plus size={17}/></button>) : <p>ไม่มีข่าวสารหรือคูปองที่เปิดใช้งานให้เลือก</p>}</div> : null}
      </section>
    </div>
    <div className="settings-column">
      <section className="settings-card popup-preview-card">
        <h2>ตัวอย่างบนมือถือ</h2><p>ภาพและข้อมูลชุดเดียวกับที่ลูกค้าเห็นจริง</p>
        <div className="popup-phone"><div className="popup-phone-status"><span>9:41</span><span>●●● ▰</span></div><div className="popup-phone-notch"/><div className="popup-phone-screen"><div className="popup-phone-brand">🐾 TAMMY <span>♧</span></div><div className="popup-phone-welcome"><small>สวัสดีค่ะ</small><strong>คุณสมาชิก</strong><p>สะสมแต้มและรับสิทธิพิเศษสำหรับน้อง ๆ</p></div><div className="popup-phone-tile">บัตรสมาชิก <span>2,480 แต้ม</span></div><div className="popup-phone-tile">สิทธิพิเศษของคุณ <span>ดูทั้งหมด ›</span></div><div className="popup-phone-bottom">หน้าหลัก　 บัตรสมาชิก　 ข่าวสาร　บัญชี</div></div>
          {previewDetails && selected ? <div className="popup-phone-detail"><PopupDetailView key={popupKey(selected)} item={selected} onBack={() => setPreviewDetails(false)} /></div> : showPreview && selected ? <div className="popup-phone-overlay"><PopupCarouselCard items={previewItems} index={index} onSelect={next => choose(popupKey(previewItems[next]))} onClose={() => setShowPreview(false)} onDetail={() => setPreviewDetails(true)} /></div> : null}
        </div>
        {selected && !showPreview && !previewDetails ? <button className="popup-reopen" type="button" onClick={() => setShowPreview(true)}>แสดง Popup อีกครั้ง</button> : null}
        {!enabled.length ? <p className="popup-empty">ยังไม่มีรายการที่แสดงให้ลูกค้าเห็น</p> : null}
      </section>
    </div>
  </div>;
}
