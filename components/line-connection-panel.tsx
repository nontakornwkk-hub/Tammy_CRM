"use client";

import { useEffect, useState } from "react";
import { Check, CircleHelp, ExternalLink, KeyRound, Link2, ShieldCheck } from "lucide-react";
import { SiLine } from "react-icons/si";
import { supabase } from "@/lib/supabase/client";

type Connection = { connected: boolean; channelId: string; channelSecret: boolean; accessToken: boolean;
  loginChannelId: string; liffId: string; liff: boolean; membershipUrl: string;
  bot: { displayName: string; basicId: string } | null; webhook: { endpoint: string; active: boolean } | null;
  webhookTested?: boolean; message?: string };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
  const response = await fetch(path, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...init?.headers } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "เชื่อมต่อไม่สำเร็จ");
  return data;
}

function Step({ number, title, ready, readyText = "พร้อมใช้งาน", children }: { number: number; title: string; ready: boolean; readyText?: string; children: React.ReactNode }) {
  return <section className="linev2-setup-card"><header className="linev2-setup-head"><span className="linev2-step-number">{number}</span><h2>{title}</h2><span className={`linev2-step-state${ready ? " ready" : ""}`}>{ready ? <><Check size={14} /> {readyText}</> : "รอตั้งค่า"}</span></header><div className="linev2-setup-body">{children}</div></section>;
}

export function LineConnectionPanel() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [serverReady, setServerReady] = useState(false);
  const [serverSecret, setServerSecret] = useState("");
  const [serverResult, setServerResult] = useState("");
  const [messaging, setMessaging] = useState({ channelId: "", channelSecret: "", accessToken: "" });
  const [login, setLogin] = useState({ loginChannelId: "", liffId: "" });
  const [busy, setBusy] = useState<"server" | "messaging" | "login" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState("");

  async function refresh() {
    try {
      const status = await api<{ configured: boolean }>("/api/line/messaging/server-key");
      setServerReady(status.configured);
      if (!status.configured) return;
      const data = await api<Connection>("/api/line/messaging/connection");
      setConnection(data);
      setMessaging(value => ({ ...value, channelId: data.channelId || value.channelId }));
      setLogin(value => ({ loginChannelId: data.loginChannelId || value.loginChannelId, liffId: data.liffId || value.liffId }));
    } catch (cause) { setErrors(value => ({ ...value, server: cause instanceof Error ? cause.message : "ตรวจสถานะไม่สำเร็จ" })); }
  }
  useEffect(() => { setBaseUrl(window.location.origin); void refresh(); }, []);

  async function checkServerKey() {
    setBusy("server"); setErrors(value => ({ ...value, server: "" }));
    try {
      const data = await api<{ valid: boolean; message: string }>("/api/line/messaging/server-key", { method: "POST", body: JSON.stringify({ secretKey: serverSecret }) });
      setServerResult(data.message); setServerSecret("");
    } catch (cause) { setErrors(value => ({ ...value, server: cause instanceof Error ? cause.message : "ตรวจคีย์ไม่สำเร็จ" })); }
    finally { setBusy(null); }
  }

  async function connectMessaging() {
    setBusy("messaging"); setErrors(value => ({ ...value, messaging: "" }));
    try {
      const data = await api<Connection>("/api/line/messaging/connection", { method: "POST", body: JSON.stringify(messaging) });
      setConnection(data);
      setMessaging(value => ({ ...value, channelSecret: "", accessToken: "" }));
      setNotices(value => ({ ...value, messaging: data.message || "เชื่อมต่อแล้ว" }));
      await refresh();
    } catch (cause) { setErrors(value => ({ ...value, messaging: cause instanceof Error ? cause.message : "เชื่อม Messaging API ไม่สำเร็จ" })); }
    finally { setBusy(null); }
  }

  async function connectLogin() {
    setBusy("login"); setErrors(value => ({ ...value, login: "" }));
    try {
      const data = await api<{ message: string }>("/api/line/messaging/connection", { method: "POST", body: JSON.stringify({ action: "login", ...login }) });
      setNotices(value => ({ ...value, login: data.message }));
      await refresh();
    } catch (cause) { setErrors(value => ({ ...value, login: cause instanceof Error ? cause.message : "บันทึก LINE Login ไม่สำเร็จ" })); }
    finally { setBusy(null); }
  }

  const webhookUrl = `${baseUrl}/api/line/messaging/webhook`;
  const membershipUrl = `${baseUrl}/line-membership`;
  const publicUrl = baseUrl.startsWith("https://") && !baseUrl.includes("localhost");
  return <div className="linev2-setup"><div className="linev2-setup-intro"><div><h2>เชื่อมต่อทีละขั้น</h2><p>ตั้งค่าตามลำดับ แต่ละส่วนบันทึกแยกกันและตรวจสถานะได้</p></div><a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer">เปิด LINE Developers <ExternalLink size={15} /></a></div>
    <Step number={1} title="ฐานข้อมูล Supabase" ready={serverReady}>
      <p>ระบบใช้ Secret key ฝั่งเซิร์ฟเวอร์เพื่อบันทึกแชตและข้อมูลสมาชิก ค่านี้ไม่ใช่ Channel Secret ของ LINE</p>
      <div className="linev2-source"><KeyRound size={17} /><span>เอาจาก <b>Supabase Dashboard → Project Settings → API Keys → Secret keys</b> คัดลอกคีย์ <code>sb_secret_…</code> แล้วตั้งชื่อ <code>SUPABASE_SECRET_KEY</code> ใน Vercel → Settings → Environment Variables</span></div>
      <label className="linev2-setup-field">ทดสอบ SUPABASE_SECRET_KEY (ไม่บันทึกในเว็บ)<input type="password" autoComplete="new-password" value={serverSecret} onChange={event => setServerSecret(event.target.value)} placeholder="วาง Secret key เพื่อตรวจสอบ แล้วนำไปตั้งใน Vercel" /></label>
      <button className="linev2-setup-action secondary" type="button" disabled={!serverSecret || busy !== null} onClick={() => void checkServerKey()}>ตรวจสอบคีย์</button>
      {serverReady && <p className="linev2-result success"><Check size={15} /> เซิร์ฟเวอร์ตั้งค่า SUPABASE_SECRET_KEY แล้ว</p>}
      {serverResult && <p className="linev2-result">{serverResult}</p>}{errors.server && <p className="linev2-result error" role="alert">{errors.server}</p>}
      <small className="linev2-safe-note"><ShieldCheck size={14} /> ช่องทดสอบส่งคีย์ให้เซิร์ฟเวอร์ตรวจเท่านั้น ไม่บันทึกลงฐานข้อมูลหรือเบราว์เซอร์</small>
    </Step>
    <Step number={2} title="LINE Messaging API · รับและตอบแชต" ready={Boolean(connection?.connected && connection.webhook?.active)}>
      <p>เปิด <b>LINE Developers → Provider ของร้าน → Messaging API channel</b> แล้วกรอก 3 ค่าจาก channel เดียวกัน</p>
      <div className="linev2-setup-fields">
        <label className="linev2-setup-field">Channel ID <small>แท็บ Basic settings → Channel ID</small><input inputMode="numeric" value={messaging.channelId} onChange={event => setMessaging({ ...messaging, channelId: event.target.value })} placeholder="ตัวเลข Channel ID" /></label>
        <label className="linev2-setup-field">Channel Secret <small>แท็บ Basic settings → Channel secret</small><input type="password" autoComplete="new-password" value={messaging.channelSecret} onChange={event => setMessaging({ ...messaging, channelSecret: event.target.value })} placeholder={connection?.channelSecret ? "บันทึกแล้ว · เว้นว่างถ้าไม่เปลี่ยน" : "Channel Secret"} /></label>
        <label className="linev2-setup-field">Channel Access Token <small>แท็บ Messaging API → Channel access token → Issue</small><input type="password" autoComplete="new-password" value={messaging.accessToken} onChange={event => setMessaging({ ...messaging, accessToken: event.target.value })} placeholder={connection?.accessToken ? "บันทึกแล้ว · เว้นว่างถ้าไม่เปลี่ยน" : "Channel Access Token"} /></label>
      </div>
      <button className="linev2-setup-action" type="button" disabled={!serverReady || !messaging.channelId || !messaging.channelSecret || !messaging.accessToken || busy !== null} onClick={() => void connectMessaging()}><SiLine /> {busy === "messaging" ? "กำลังทดสอบ…" : "เชื่อม Messaging API"}</button>
      {connection?.bot && <p className="linev2-result success"><Check size={15} /> เชื่อมบัญชี {connection.bot.displayName} ({connection.bot.basicId})</p>}
      {notices.messaging && <p className="linev2-result">{notices.messaging}</p>}{errors.messaging && <p className="linev2-result error" role="alert">{errors.messaging}</p>}
      <div className="linev2-urlbox"><strong>Webhook URL ที่ต้องใส่ในแท็บ Messaging API</strong><code>{webhookUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(webhookUrl)}>คัดลอก URL</button><small>เปิด Use webhook ใน LINE Developers ด้วย {publicUrl ? "· URL นี้เป็น HTTPS" : "· localhost ใช้รับ webhook จริงไม่ได้ ต้อง deploy ก่อน"}</small></div>
    </Step>
    <Step number={3} title="LINE Login + LIFF · สมัครและเช็กแต้ม" ready={Boolean(connection?.liff)} readyText="บันทึกแล้ว · รอทดสอบจริง">
      <p>ใช้ <b>LINE Login channel ใน Provider เดียวกัน</b> (คนละ channel กับ Messaging API) สำหรับยืนยันตัวตนสมาชิก</p>
      <div className="linev2-setup-fields">
        <label className="linev2-setup-field">LINE Login Channel ID <small>LINE Developers → LINE Login channel → Basic settings → Channel ID</small><input inputMode="numeric" value={login.loginChannelId} onChange={event => setLogin({ ...login, loginChannelId: event.target.value })} placeholder="Channel ID ของ LINE Login" /></label>
        <label className="linev2-setup-field">LIFF ID <small>LINE Login channel → แท็บ LIFF → LIFF ID</small><input value={login.liffId} onChange={event => setLogin({ ...login, liffId: event.target.value })} placeholder="เช่น 2000000000-xxxxxxxx" /></label>
      </div>
      <button className="linev2-setup-action" type="button" disabled={!serverReady || !connection?.connected || !login.loginChannelId || !login.liffId || busy !== null} onClick={() => void connectLogin()}>{busy === "login" ? "กำลังบันทึก…" : "บันทึก LINE Login / LIFF"}</button>
      {notices.login && <p className="linev2-result success">{notices.login}</p>}{errors.login && <p className="linev2-result error" role="alert">{errors.login}</p>}
      <div className="linev2-urlbox"><strong>LIFF Endpoint URL / หน้าสมาชิกที่ใช้งานจริง</strong><code>{membershipUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(membershipUrl)}>คัดลอก URL</button><small>{publicUrl ? "ตั้ง URL นี้เป็น Endpoint URL ใน LIFF และเปิด scope profile + openid" : "ยังเป็น localhost ต้อง deploy เพื่อได้ลิงก์ HTTPS ก่อนใช้กับลูกค้า"}</small></div>
    </Step>
    <div className="linev2-setup-hint"><CircleHelp size={18} /><p><b>ค่าเพิ่มเติม:</b> URL และ Publishable key ของ Supabase ตั้งเป็น <code>NEXT_PUBLIC_SUPABASE_URL</code> และ <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> บนโฮสต์ ส่วน LINE Login Channel Secret ยังไม่ต้องใช้ในขั้นตอนนี้ อย่านำมาใส่แทน Messaging API Channel Secret</p></div>
  </div>;
}
