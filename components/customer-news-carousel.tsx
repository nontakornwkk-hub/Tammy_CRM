"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, PawPrint } from "lucide-react";
import { useRef, useState } from "react";
import type { PopupDisplay } from "@/lib/popup-content";

export function CustomerNewsCarousel({ news, onSelect }: { news: PopupDisplay[]; onSelect: (item: PopupDisplay) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  function go(next: number) {
    const target = (next + news.length) % news.length;
    const slide = track.current?.children[target] as HTMLElement | undefined;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (slide && track.current) track.current.scrollTo({ left: slide.offsetLeft - (track.current.children[0] as HTMLElement).offsetLeft, behavior: reduceMotion ? "instant" : "smooth" });
  }
  return <div className="customer-news-carousel" role="region" aria-roledescription="คารูเซล" aria-label="ข่าวสารล่าสุด">
    <div className="customer-news-track" ref={track} onScroll={() => { const el = track.current; const first = el?.children[0] as HTMLElement | undefined; if (el && first) setIndex(Math.min(news.length - 1, Math.max(0, Math.round(el.scrollLeft / (first.offsetWidth + 10))))); }}>
      {news.map((item, position) => <button type="button" className="customer-news-slide" key={item.id} onClick={() => onSelect(item)} aria-label={`${item.title} ข่าว ${position + 1} จาก ${news.length}`}>
        <div className="customer-news-slide-picture">{item.image ? <Image src={item.image} alt="" fill sizes="(max-width:520px) 90vw, 480px" unoptimized /> : <PawPrint size={56} />}</div>
        <div className="customer-news-slide-copy">{item.createdAt && <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" })}</time>}<h2>{item.title}</h2><p>{item.summary}</p><span>อ่านเพิ่มเติม <ChevronRight size={15} /></span></div>
      </button>)}
    </div>
    {news.length > 1 && <div className="customer-news-controls"><button type="button" onClick={() => go(index - 1)} aria-label="ข่าวก่อนหน้า"><ChevronLeft size={19} /></button><div className="customer-news-dots">{news.map((item, i) => <button type="button" key={item.id} className={index === i ? "active" : ""} aria-label={`ข่าวที่ ${i + 1}`} aria-current={index === i ? "true" : undefined} onClick={() => go(i)} />)}</div><button type="button" onClick={() => go(index + 1)} aria-label="ข่าวถัดไป"><ChevronRight size={19} /></button></div>}
  </div>;
}
