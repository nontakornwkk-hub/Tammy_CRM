"use client";

import { useEffect, useState } from "react";
import { SiLine } from "react-icons/si";
import { Cable, Copy, Gift, Link2, Menu, Settings2 } from "lucide-react";
import { Sidebar } from "./sidebar";
import { LineConnectionPanel } from "./line-connection-panel";
import { PosConnectionCard } from "./pos-connection-card";
import { LineCouponCampaign } from "./line-coupon-campaign";
import { crmRole } from "@/lib/supabase/crm-data";

type Tab = "connection" | "webhook" | "pos" | "coupons";
type Connection = { connected: boolean; bot: { displayName: string } | null; webhook: { endpoint: string; active: boolean } | null };

export function LineManager() {
  const [mobileMenu, setMobileMenu] = useState(false);
  const [tab, setTab] = useState<Tab>("connection");
  const [visitedPos, setVisitedPos] = useState(false);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const role = crmRole();

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const webhookUrl = connection?.webhook?.endpoint || (origin ? `${origin}/api/line/messaging/webhook` : "");
  async function copyWebhook() {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  }

  return <div className="app-shell linev2-page">
    {mobileMenu && <button className="sidebar-backdrop" type="button" aria-label="ปิดเมนู" onClick={() => setMobileMenu(false)} />}
    <div className={`sidebar-wrap${mobileMenu ? " open" : ""}`}><Sidebar activePath="/line" onClose={() => setMobileMenu(false)} /></div>
    <main className="main-content linev2-main">
      <header className="page-header linev2-header">
        <button className="mobile-menu" type="button" onClick={() => setMobileMenu(true)} aria-label="เปิดเมนู"><Menu /></button>
        <span className="linev2-mark"><SiLine /></span>
        <div className="heading-copy"><h1>LINE</h1><p>จัดการการเชื่อมต่อและบริการสมาชิกผ่าน LINE</p></div>
        {role === "owner" && <span className={`linev2-status${connection?.connected ? " ready" : ""}`}><i />{connection?.connected ? `เชื่อม ${connection.bot?.displayName || "LINE"}` : "รอเชื่อมต่อ"}</span>}
      </header>
      {role === "owner" ? <>
        <nav className="linev2-tabs" aria-label="หน้า LINE">
          <button type="button" className={tab === "connection" ? "active" : ""} onClick={() => setTab("connection")}><Settings2 size={17} /> การเชื่อมต่อ</button>
          <button type="button" className={tab === "webhook" ? "active" : ""} onClick={() => setTab("webhook")}><Link2 size={17} /> ตั้งค่า Webhook</button>
          <button type="button" className={tab === "coupons" ? "active" : ""} onClick={() => setTab("coupons")}><Gift size={17} /> ส่งคูปอง</button>
          <button type="button" className={tab === "pos" ? "active" : ""} onClick={() => { setVisitedPos(true); setTab("pos"); }}><Cable size={17} /> POS API</button>
        </nav>
        <div className="linev2-tab-panel" hidden={tab !== "connection"}><LineConnectionPanel onConnection={setConnection} /></div>
        {visitedPos ? <div className="linev2-tab-panel" hidden={tab !== "pos"}><PosConnectionCard /></div> : null}
        {tab === "coupons" ? <div className="linev2-tab-panel"><LineCouponCampaign /></div> : null}
        {tab === "webhook" && <section className="linev2-webhook-placeholder">
          <div className="linev2-webhook-heading"><span><Link2 size={23} /></span><div><small>LINE Messaging API</small><h2>ตั้งค่า Webhook</h2><p>ใช้ URL นี้เพื่อให้ลูกค้าดูแต้มผ่าน LINE และอัปเดตโปรไฟล์สมาชิกที่เชื่อมบัญชี</p></div></div>
          <div className="linev2-webhook-url"><code>{webhookUrl || "กำลังตรวจสอบ URL…"}</code><button type="button" onClick={() => void copyWebhook()} disabled={!webhookUrl}><Copy size={15} /> {copied ? "คัดลอกแล้ว" : "คัดลอก URL"}</button></div>
          <p className="linev2-webhook-note">หลังวาง URL ใน LINE Developers ให้เปิด Use webhook และกด Verify</p>
        </section>}
      </> : <section className="linev2-webhook-placeholder"><h2>การตั้งค่า LINE</h2><p>เจ้าของร้านสามารถจัดการการเชื่อมต่อ LINE ได้จากหน้านี้</p></section>}
    </main>
  </div>;
}
