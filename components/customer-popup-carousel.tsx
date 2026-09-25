"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Megaphone, Tag, X } from "lucide-react";
import { useRef, useState } from "react";
import { formatCurrentPopupPeriod, formatPopupDate, type PopupDisplay } from "@/lib/popup-content";

function PopupArtwork({ item }: { item: PopupDisplay }) {
  return <div className="customer-popup-hero"><div className="customer-popup-art">
    {item.image ? <Image src={item.image} alt={item.title} fill sizes="225px" unoptimized /> : <span>{item.source === "news" ? <Megaphone size={72}/> : <Tag size={72}/>}</span>}
  </div></div>;
}

type PopupCardProps = {
  items: PopupDisplay[];
  index: number;
  onSelect: (index: number) => void;
  onClose: () => void;
  onDetail: () => void;
};

export function PopupCarouselCard({ items, index, onSelect, onClose, onDetail }: PopupCardProps) {
  const touchX = useRef<number | null>(null);
  const item = items[index];
  if (!item) return null;
  const step = (direction: number) => onSelect((index + direction + items.length) % items.length);

  return <section className="customer-popup-modal" role="dialog" aria-modal="true" aria-label="ข่าวสารและสิทธิพิเศษ"
    onClick={event => event.stopPropagation()}
    onTouchStart={event => { touchX.current = event.touches[0].clientX; }}
    onTouchEnd={event => { if (touchX.current !== null && Math.abs(event.changedTouches[0].clientX - touchX.current) > 35) step(event.changedTouches[0].clientX < touchX.current ? 1 : -1); touchX.current = null; }}>
    <button className="customer-popup-close" type="button" onClick={onClose} aria-label="ปิด"><X size={19}/></button>
    <PopupArtwork key={item.image || item.id} item={item} />
    <div className="customer-popup-body">
      <div className="customer-popup-eyebrow"><span>{item.category}</span>{item.createdAt ? <small>สร้างเมื่อ {formatPopupDate(item.createdAt)}</small> : item.images.length > 1 ? <small>{item.images.length} รูป</small> : null}</div>
      <h2>{item.title}</h2>
      {item.summary ? <p>{item.summary}</p> : null}
      <div className="customer-popup-meta">
        {item.startsAt || item.expiresAt ? <small className={item.startsAt && Date.parse(item.startsAt) > Date.now() ? "customer-popup-upcoming" : "customer-popup-period"}><CalendarDays size={13}/>{item.startsAt && Date.parse(item.startsAt) > Date.now() ? "เร็ว ๆ นี้ · " : ""}{item.category === "โปรโมชั่น" ? "ช่วงโปร " : ""}{formatCurrentPopupPeriod(item.startsAt, item.expiresAt)}</small> : null}
      </div>
      <button className="customer-popup-action" type="button" onClick={onDetail}>ดูรายละเอียด <ArrowUpRight size={17}/></button>
      {items.length > 1 ? <div className="customer-popup-pagination"><button type="button" onClick={() => step(-1)} aria-label="รายการก่อนหน้า"><ChevronLeft size={19}/></button><div>{items.map((entry, dot) => <button key={entry.source + entry.id} type="button" className={dot === index ? "active" : ""} onClick={() => onSelect(dot)} aria-label={`รายการที่ ${dot + 1}`}/>)}</div><span>{index + 1} / {items.length}</span><button type="button" onClick={() => step(1)} aria-label="รายการถัดไป"><ChevronRight size={19}/></button></div> : null}
    </div>
  </section>;
}

export function CustomerPopupCarousel({ items, close }: { items: PopupDisplay[]; close: () => void }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const item = items[index];
  if (!item) return null;
  const detail = () => router.push(`/customer/content/${encodeURIComponent(item.source + ":" + item.id)}`);
  return <div className="customer-popup-backdrop" role="presentation" onClick={close}>
    <PopupCarouselCard items={items} index={index} onSelect={setIndex} onClose={close} onDetail={detail} />
  </div>;
}
