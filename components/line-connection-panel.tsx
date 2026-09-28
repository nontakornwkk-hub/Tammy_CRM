"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Check, CircleHelp, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { SiLine } from "react-icons/si";
import { supabase } from "@/lib/supabase/client";

type Connection = { connected: boolean; channelId: string; channelSecret: boolean; accessToken: boolean;
  loginChannelId: string; liffId: string; liff: boolean; membershipUrl: string;
  bot: { displayName: string; basicId: string; pictureUrl?: string | null } | null; webhook: { endpoint: string; active: boolean } | null;
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
  const [supabaseConfigured, setSupabaseConfigured] = useState({ url: false, publishable: false, secret: false });
  const [serverSecret, setServerSecret] = useState("");
  const [supabaseChecks, setSupabaseChecks] = useState<{ url: boolean; publishable: boolean; secret: boolean } | null>(null);
  const [localSaveAvailable, setLocalSaveAvailable] = useState(false);
  const [serverResult, setServerResult] = useState("");
  const [messaging, setMessaging] = useState({ channelId: "", channelSecret: "", accessToken: "" });
  const [login, setLogin] = useState({ loginChannelId: "", liffId: "" });
  const [busy, setBusy] = useState<"server" | "messaging" | "login" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState("");
  const [editingMessaging, setEditingMessaging] = useState(false);

  async function refresh() {
    try {
      const status = await api<{ configured: { url: boolean; publishable: boolean; secret: boolean }; checks: { url: boolean; publishable: boolean; secret: boolean }; localSaveAvailable: boolean; projectUrl: string }>("/api/line/messaging/supabase-config");
      setServerReady(status.checks.url && status.checks.publishable && status.checks.secret);
      setSupabaseConfigured(status.configured);
      setSupabaseChecks(status.checks);
      setLocalSaveAvailable(status.localSaveAvailable);
      if (!status.configured.secret) return;
      const data = await api<Connection>("/api/line/messaging/connection");
      setConnection(data);
      setEditingMessaging(false);
      setMessaging(value => ({ ...value, channelId: data.channelId || value.channelId }));
      setLogin(value => ({ loginChannelId: data.loginChannelId || value.loginChannelId, liffId: data.liffId || value.liffId }));
    } catch (cause) { setErrors(value => ({ ...value, server: cause instanceof Error ? cause.message : "ตรวจสถานะไม่สำเร็จ" })); }
  }
  useEffect(() => { setBaseUrl(window.location.origin); void refresh(); }, []);

  async function checkSupabase(saveLocal = false) {
    setBusy("server"); setErrors(value => ({ ...value, server: "" }));
    try {
      const data = await api<{ checks: { url: boolean; publishable: boolean; secret: boolean }; savedLocal?: boolean }>("/api/line/messaging/supabase-config", {
        method: "POST", body: JSON.stringify({ action: saveLocal ? "saveLocal" : "test", secretKey: serverSecret || undefined }) });
      setSupabaseChecks(data.checks);
      if (data.savedLocal) { setServerReady(true); setServerSecret(""); await refresh(); }
      setServerResult(data.savedLocal ? "บันทึกใน .env.local แล้ว กรุณารีสตาร์ตเซิร์ฟเวอร์พัฒนาเพื่อให้ค่าฝั่งเบราว์เซอร์อัปเดต" : "ทดสอบเสร็จแล้ว ดูผลของแต่ละค่าได้ด้านล่าง");
    } catch (cause) { setErrors(value => ({ ...value, server: cause instanceof Error ? cause.message : "ตรวจ Supabase ไม่สำเร็จ" })); }
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

  async function testLogin() {
    setBusy("login"); setErrors(value => ({ ...value, login: "" }));
    try {
      const data = await api<{ reachable: boolean; message: string }>("/api/line/messaging/connection", {
        method: "POST", body: JSON.stringify({ action: "testLogin" }) });
      setNotices(value => ({ ...value, login: data.message }));
    } catch (cause) { setErrors(value => ({ ...value, login: cause instanceof Error ? cause.message : "ทดสอบ LIFF ไม่สำเร็จ" })); }
    finally { setBusy(null); }
  }

  const webhookUrl = `${baseUrl}/api/line/messaging/webhook`;
  const membershipUrl = `${baseUrl}/line-membership`;
  const publicUrl = baseUrl.startsWith("https://") && !baseUrl.includes("localhost");
  return <div className="linev2-setup"><div className="linev2-setup-intro"><div><h2>เชื่อมต่อทีละขั้น</h2><p>ตั้งค่าตามลำดับ แต่ละส่วนบันทึกแยกกันและตรวจสถานะได้</p></div><a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer">เปิด LINE Developers <ExternalLink size={15} /></a></div>
    <Step number={1} title="ฐานข้อมูล Supabase" ready={serverReady}>
      <p>Project URL และ Publishable key ตั้งไว้ในระบบแล้ว เหลือเพียง Secret key สำหรับบันทึกแชตและข้อมูลสมาชิก</p>
      <div className="linev2-source"><KeyRound size={17} /><span>เอาจาก <b>Supabase Dashboard → Project Settings → API Keys → Secret keys</b> คัดลอกคีย์ที่ขึ้นต้น <code>sb_secret_</code></span></div>
      {localSaveAvailable ? <><label className="linev2-setup-field">Supabase Secret key <small>ใช้เฉพาะฝั่งเซิร์ฟเวอร์ · ไม่ใช่ Channel Secret ของ LINE</small><input type="password" autoComplete="new-password" value={serverSecret} onChange={event => setServerSecret(event.target.value)} placeholder={supabaseConfigured.secret ? "ตั้งค่าแล้ว · เว้นว่างเพื่อทดสอบค่าเดิม" : "วาง Secret key"} /></label><div className="linev2-setup-buttons"><button className="linev2-setup-action" type="button" disabled={busy !== null || !serverSecret || !supabaseConfigured.url || !supabaseConfigured.publishable} onClick={() => void checkSupabase(true)}>เชื่อมและบันทึกใน .env.local</button></div></> : <div className="linev2-urlbox"><strong>เว็บจริงต้องตั้งค่าบน Vercel</strong><small>ใส่ SUPABASE_SECRET_KEY ใน Project Settings → Environment Variables แล้ว Redeploy ระบบจะตรวจสถานะให้อัตโนมัติ คีย์จะไม่แสดงในหน้านี้</small><a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">เปิด Vercel Dashboard <ExternalLink size={14} /></a></div>}
      {supabaseChecks && <p className={`linev2-result ${supabaseChecks.url && supabaseChecks.publishable && supabaseChecks.secret ? "success" : "error"}`}>{supabaseChecks.url && supabaseChecks.publishable && supabaseChecks.secret ? "✓ Supabase เชื่อมต่อสำเร็จ" : !supabaseChecks.url || !supabaseChecks.publishable ? "Project URL หรือ Publishable key บนเซิร์ฟเวอร์ยังไม่พร้อม" : "Secret key ยังไม่ผ่านการตรวจสอบ"}</p>}
      {serverReady && <p className="linev2-result success"><Check size={15} /> เซิร์ฟเวอร์ตั้งค่าครบแล้ว</p>}
      {!localSaveAvailable && <p className="linev2-result">Project URL และ Publishable key ตั้งไว้แล้ว เหลือเพียง Secret key บน Vercel</p>}
      {serverResult && <p className="linev2-result">{serverResult}</p>}{errors.server && <p className="linev2-result error" role="alert">{errors.server}</p>}
      <small className="linev2-safe-note"><ShieldCheck size={14} /> คีย์ที่กรอกไม่แสดงกลับมา และไฟล์ .env.local ไม่ถูกส่งขึ้น Git</small>
    </Step>
    <Step number={2} title="LINE Messaging API · รับและตอบแชต" ready={Boolean(connection?.connected && connection.webhook?.active)}>
      <p>เปิด <b>LINE Developers → Provider ของร้าน → Messaging API channel</b> แล้วกรอกเฉพาะ Secret และ Access Token ระบบจะอ่าน Channel ID จาก LINE ให้เองเมื่อรองรับ</p>
      {connection?.connected && !editingMessaging ? <div className="linev2-connected-profile">{connection.bot?.pictureUrl ? <Image src={connection.bot.pictureUrl} alt="รูปโปรไฟล์ LINE Official Account" width={56} height={56} unoptimized /> : <span className="linev2-connected-avatar"><SiLine size={26} /></span>}<div><strong>{connection.bot?.displayName || "LINE Official Account"}</strong><small>{connection.bot?.basicId || "เชื่อมต่อแล้ว"}</small><span><Check size={14} /> บันทึกการเชื่อมต่อแล้ว · Secret และ Token ถูกซ่อน</span></div><button type="button" className="linev2-setup-action secondary" onClick={() => setEditingMessaging(true)}>เปลี่ยนการเชื่อมต่อ</button></div> : <><div className="linev2-setup-fields">
        <label className="linev2-setup-field">Channel Secret <small>แท็บ Basic settings → Channel secret</small><input type="password" autoComplete="new-password" value={messaging.channelSecret} onChange={event => setMessaging({ ...messaging, channelSecret: event.target.value })} placeholder={connection?.channelSecret ? "บันทึกแล้ว · เว้นว่างถ้าไม่เปลี่ยน" : "Channel Secret"} /></label>
        <label className="linev2-setup-field">Channel Access Token <small>แท็บ Messaging API → Channel access token → Issue</small><input type="password" autoComplete="new-password" value={messaging.accessToken} onChange={event => setMessaging({ ...messaging, accessToken: event.target.value })} placeholder={connection?.accessToken ? "บันทึกแล้ว · เว้นว่างถ้าไม่เปลี่ยน" : "Channel Access Token"} /></label>
      </div>
      <details className="linev2-optional"><summary>ข้อมูลเพิ่มเติม · Channel ID (กรอกเฉพาะเมื่อระบบขอ)</summary><label className="linev2-setup-field">Channel ID <small>แท็บ Basic settings → Channel ID</small><input inputMode="numeric" value={messaging.channelId} onChange={event => setMessaging({ ...messaging, channelId: event.target.value })} placeholder="ตัวเลข Channel ID" /></label></details>
      <button className="linev2-setup-action" type="button" disabled={!serverReady || !messaging.channelSecret || !messaging.accessToken || busy !== null} onClick={() => void connectMessaging()}><SiLine /> {busy === "messaging" ? "กำลังเชื่อมและบันทึก…" : "เชื่อมและบันทึก Messaging API"}</button>{editingMessaging && <button className="linev2-setup-action secondary" type="button" onClick={() => setEditingMessaging(false)}>ยกเลิก</button>}</>}
      {connection?.connected && <button className="linev2-setup-action secondary" type="button" disabled={busy !== null} onClick={() => void refresh()}>ทดสอบสถานะอีกครั้ง</button>}
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
      {connection?.liff && <div className="linev2-setup-buttons"><button className="linev2-setup-action secondary" type="button" disabled={busy !== null} onClick={() => void testLogin()}>ทดสอบ LIFF URL</button><a className="linev2-setup-action secondary" href="/line-membership" target="_blank" rel="noreferrer">เปิดหน้าสมาชิกทดสอบจริง</a></div>}
      {notices.login && <p className="linev2-result success">{notices.login}</p>}{errors.login && <p className="linev2-result error" role="alert">{errors.login}</p>}
      <div className="linev2-urlbox"><strong>LIFF Endpoint URL / หน้าสมาชิกที่ใช้งานจริง</strong><code>{membershipUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(membershipUrl)}>คัดลอก URL</button><small>{publicUrl ? "ตั้ง URL นี้เป็น Endpoint URL ใน LIFF และเปิด scope profile + openid" : "ยังเป็น localhost ต้อง deploy เพื่อได้ลิงก์ HTTPS ก่อนใช้กับลูกค้า"}</small></div>
    </Step>
    <div className="linev2-setup-hint"><CircleHelp size={18} /><p><b>ค่าเพิ่มเติม:</b> URL และ Publishable key ของ Supabase ตั้งเป็น <code>NEXT_PUBLIC_SUPABASE_URL</code> และ <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> บนโฮสต์ ส่วน LINE Login Channel Secret ยังไม่ต้องใช้ในขั้นตอนนี้ อย่านำมาใส่แทน Messaging API Channel Secret</p></div>
  </div>;
}
