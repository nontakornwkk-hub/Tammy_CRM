"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, Megaphone, Tag, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatCurrentPopupPeriod, formatPopupDate, normalizePopupDisplay, type PopupDisplay } from "@/lib/popup-content";

export function PopupDetailView({ item, onBack }: { item: PopupDisplay; onBack?: () => void }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [photoRatio, setPhotoRatio] = useState(1.6);
  const photos = item.images.length ? item.images : item.image ? [item.image] : [];
  const photo = photos[Math.min(photoIndex, photos.length - 1)];

  return <main className="customer-detail-page">
    <header className="customer-detail-header">
      {onBack ? <button type="button" onClick={onBack} aria-label="กลับไปตัวอย่าง Popup"><ArrowLeft size={20}/></button> : <Link href="/customer" aria-label="กลับหน้าลูกค้า"><ArrowLeft size={20}/></Link>}
      <span>รายละเอียด{item.category}</span><span aria-hidden="true">🐾</span>
    </header>
    <div className="customer-detail-hero" style={{ aspectRatio: photoRatio }}>
      {photo ? <Image src={photo} alt={item.title} fill sizes="(max-width: 520px) 100vw, 520px" unoptimized onLoad={event => { const image = event.currentTarget; if (image.naturalWidth && image.naturalHeight) setPhotoRatio(image.naturalWidth / image.naturalHeight); }} /> : <span>{item.source === "news" ? <Megaphone size={88}/> : <Tag size={88}/>}</span>}
      {photos.length > 1 ? <><button type="button" className="customer-detail-previous" onClick={() => setPhotoIndex(index => (index - 1 + photos.length) % photos.length)} aria-label="รูปก่อนหน้า"><ChevronLeft size={21}/></button><button type="button" className="customer-detail-next" onClick={() => setPhotoIndex(index => (index + 1) % photos.length)} aria-label="รูปถัดไป"><ChevronRight size={21}/></button><span className="customer-detail-photo-count">{photoIndex + 1} / {photos.length}</span></> : null}
    </div>
    {photos.length > 1 ? <div className="customer-detail-thumbnails" aria-label="เลือกรูปภาพ">{photos.map((url, index) => <button type="button" key={url + index} className={photoIndex === index ? "active" : ""} onClick={() => setPhotoIndex(index)} aria-label={`ดูรูปที่ ${index + 1}`}><Image src={url} alt="" fill sizes="72px" unoptimized /></button>)}</div> : null}
    <article className="customer-detail-article">
      <div className="customer-detail-kicker"><span>{item.category}</span>{item.createdAt ? <small><CalendarDays size={14}/> สร้างเมื่อ {formatPopupDate(item.createdAt)}</small> : null}</div>
      <h1>{item.title}</h1>
      {item.summary ? <p className="customer-detail-summary">{item.summary}</p> : null}
      {item.category === "โปรโมชั่น" && item.startsAt ? <div className="customer-detail-start"><CalendarDays size={18}/><span>{Date.parse(item.startsAt) > Date.now() ? "เร็ว ๆ นี้ · ช่วงโปร " : "ใช้ได้ "}<strong>{formatCurrentPopupPeriod(item.startsAt, item.expiresAt)}</strong></span></div> : null}
      {item.expiresAt ? <div className="customer-detail-expiry"><Timer size={19}/><span>หมดโปรวันที่ <strong>{formatPopupDate(item.expiresAt)}</strong></span></div> : null}
      {item.details ? <div className="customer-detail-description"><h2>รายละเอียด</h2><p>{item.details}</p></div> : null}
    </article>
  </main>;
}

export function CustomerContentDetail({ id }: { id: string }) {
  const [item, setItem] = useState<PopupDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let current = true;
    void supabase.from("public_shop_profiles").select("card_design").eq("slug", "tammy").maybeSingle().then(({ data }) => {
      if (!current) return;
      const design = data?.card_design as Record<string, unknown> | undefined;
      setItem(normalizePopupDisplay(design?.popup_content).find(entry => entry.source + ":" + entry.id === id && entry.active) ?? null);
      setLoading(false);
    });
    return () => { current = false; };
  }, [id]);
  if (item) return <PopupDetailView item={item} />;
  return <main className="customer-detail-page"><header className="customer-detail-header"><Link href="/customer" aria-label="กลับหน้าลูกค้า"><ArrowLeft size={20}/></Link><span>รายละเอียดรายการ</span><span aria-hidden="true">🐾</span></header>{loading ? <p className="customer-detail-state">กำลังโหลดรายละเอียด…</p> : <div className="customer-detail-state"><Megaphone size={42}/><h1>ไม่พบรายการนี้</h1><p>รายการอาจถูกปิดแสดงแล้ว</p><Link href="/customer">กลับหน้าลูกค้า</Link></div>}</main>;
}
