"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Sidebar } from "./sidebar";

const PHONE_WIDTH = 458;
const PHONE_HEIGHT = 974;
const DEFAULT_SCALE = .8;

export function CustomerPreview() {
  const [zoom, setZoom] = useState(1);
  const scale = DEFAULT_SCALE * zoom;

  return <div className="app-shell customer-preview-page">
    <div className="sidebar-wrap"><Sidebar activePath="/customer-preview" /></div>
    <main className="main-content customer-preview-main" aria-label="ตัวอย่างหน้าลูกค้า">
      <div className="customer-preview-toolbar" aria-label="เครื่องมือซูมตัวอย่าง">
        <span>มุมมอง iPhone 18 Pro Max</span>
        <div className="customer-preview-zoom-controls">
          <button type="button" aria-label="ซูมออก" title="ซูมออก" disabled={zoom <= .75} onClick={() => setZoom(current => Math.max(.75, +(current - .25).toFixed(2)))}><Minus size={18} /></button>
          <output aria-live="polite">{Math.round(scale * 100)}%</output>
          <button type="button" aria-label="ซูมเข้า" title="ซูมเข้า" disabled={zoom >= 3} onClick={() => setZoom(current => Math.min(3, +(current + .25).toFixed(2)))}><Plus size={18} /></button>
          <button type="button" className="customer-preview-fit-button" aria-label="กลับไปที่ 80 เปอร์เซ็นต์" title="กลับไปที่ 80%" disabled={zoom === 1} onClick={() => setZoom(1)}><Maximize2 size={16} /><span>กลับ 80%</span></button>
        </div>
      </div>
      <div className="customer-preview-workspace">
        <figure className="customer-preview-fit" style={{ width: PHONE_WIDTH * scale, height: PHONE_HEIGHT * scale }}>
          <div className="customer-preview-device" style={{ transform: `scale(${scale})` }} aria-label="ตัวอย่างหน้าเว็บลูกค้าบน iPhone 18 Pro Max">
            <div className="customer-preview-status" aria-hidden="true"><span>9:41</span><i /><span>●●● ◕ ▰</span></div>
            <iframe src="/customer-preview/portal" title="ตัวอย่างหน้าลูกค้า" />
            <div className="customer-preview-home-indicator" aria-hidden="true" />
          </div>
          <figcaption>พรีวิวแอดมิน · ข้อมูลสมาชิกและการกดใช้คูปอง/แลกรางวัลเป็นการจำลอง ไม่บันทึกจริง</figcaption>
        </figure>
      </div>
    </main>
  </div>;
}
