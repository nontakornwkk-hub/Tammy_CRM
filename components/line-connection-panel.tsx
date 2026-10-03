"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, KeyRound, ShieldCheck } from "lucide-react";
import { SiLine } from "react-icons/si";
import { supabase } from "@/lib/supabase/client";
import { cachedConnectionStatus, loadConnectionStatus, type LineConnectionStatus } from "@/lib/connection-status";

type Connection = LineConnectionStatus;

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

export function LineConnectionPanel({ onConnection }: { onConnection?: (connection: Connection) => void }) {
  const initial = useRef(cachedConnectionStatus()).current;
  const active = useRef(true);
  const requestRevision = useRef(0);
  const [connection, setConnection] = useState<Connection | null>(initial?.line ?? null);
  const [serverReady, setServerReady] = useState(Boolean(initial?.server.checks.url && initial.server.checks.publishable && initial.server.checks.secret));
  const [supabaseConfigured, setSupabaseConfigured] = useState(initial?.server.configured ?? { url: false, publishable: false, secret: false });
  const [serverSecret, setServerSecret] = useState("");
  const [supabaseChecks, setSupabaseChecks] = useState<{ url: boolean; publishable: boolean; secret: boolean } | null>(initial?.server.checks ?? null);
  const [localSaveAvailable, setLocalSaveAvailable] = useState(initial?.server.localSaveAvailable ?? false);
  const [serverResult, setServerResult] = useState("");
  const [messaging, setMessaging] = useState({ channelId: initial?.line?.channelId ?? "", channelSecret: "", accessToken: "" });
  const [login, setLogin] = useState({ loginChannelId: initial?.line?.loginChannelId ?? "", liffId: initial?.line?.liffId ?? "" });
  const [busy, setBusy] = useState<"server" | "messaging" | "login" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState("");
  const [editingMessaging, setEditingMessaging] = useState(false);
  const [editingServer, setEditingServer] = useState(false);
  const [editingLogin, setEditingLogin] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(!initial);

  async function refresh(force = true) {
    const revision = ++requestRevision.current;
    try {
      const snapshot = await loadConnectionStatus(force);
      if (!active.current || revision !== requestRevision.current) return;
      const status = snapshot.server;
      setServerReady(status.checks.url && status.checks.publishable && status.checks.secret);
      setSupabaseConfigured(status.configured); setSupabaseChecks(status.checks);
      setLocalSaveAvailable(status.localSaveAvailable);
      setErrors(value => ({ ...value, server: "", messaging: snapshot.lineError }));
      if (snapshot.line) {
        const data = snapshot.line;
        setConnection(data); onConnection?.(data);
        setMessaging(value => ({ ...value, channelId: data.channelId || value.channelId }));
        setLogin(value => ({ loginChannelId: data.loginChannelId || value.loginChannelId, liffId: data.liffId || value.liffId }));
      }
    } catch (cause) {
      if (active.current && revision === requestRevision.current) setErrors(value => ({ ...value, server: cause instanceof Error ? cause.message : "ตรวจสถานะไม่สำเร็จ" }));
    } finally { if (active.current && revision === requestRevision.current) setLoadingConfig(false); }
  }
  useEffect(() => {
    active.current = true; setBaseUrl(window.location.origin); void refresh(false);
    return () => { active.current = false; requestRevision.current += 1; };
  }, []);
async function checkSupabase(saveLocal = false) {
    setBusy("server"); setErrors(value => ({ ...value, server: "" }));
    try {
      const data = await api<{ checks: { url: boolean; publishable: boolean; secret: boolean }; savedLocal?: boolean }>("/api/line/messaging/supabase-config", {
        method: "POST", body: JSON.stringify({ action: saveLocal ? "saveLocal" : "test", secretKey: serverSecret || undefined }) });
      setSupabaseChecks(data.checks);
      if (data.savedLocal) { setServerReady(true); setServerSecret(""); setEditingServer(false); await refresh(); }
      setServerResult(data.savedLocal ? "บันทึกใน .env.local แล้ว กรุณารีสตาร์ตเซิร์ฟเวอร์พัฒนาเพื่อให้ค่าฝั่งเบราว์เซอร์อัปเดต" : "ทดสอบเสร็จแล้ว ดูผลของแต่ละค่าได้ด้านล่าง");
    } catch (cause) { setErrors(value => ({ ...value, server: cause instanceof Error ? cause.message : "ตรวจ Supabase ไม่สำเร็จ" })); }
    finally { setBusy(null); }
  }

  async function connectMessaging() {
    setBusy("messaging"); setErrors(value => ({ ...value, messaging: "" }));
    try {
      const data = await api<Connection>("/api/line/messaging/connection", { method: "POST", body: JSON.stringify(messaging) });
      setConnection(data); setEditingMessaging(false);
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
      setEditingLogin(false);
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

  const publicBaseUrl = baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1") ? "https://tammy-crm.vercel.app" : baseUrl;
  const webhookUrl = `${publicBaseUrl}/api/line/messaging/webhook`;
  const membershipUrl = `${publicBaseUrl}/customer`;
  const adminLoginUrl = `${publicBaseUrl}/login`;
  const richMenuUrl = connection?.liffId ? `https://liff.line.me/${connection.liffId}` : "";
  const memberLoginUrl = richMenuUrl || `${publicBaseUrl}/customer`;
  const publicUrl = publicBaseUrl.startsWith("https://") && !publicBaseUrl.includes("localhost");
  const hasSavedMessaging = Boolean(connection?.channelSecret && connection?.accessToken);
  return <div className="linev2-setup"><div className="linev2-setup-intro"><div><h2>การเชื่อมต่อ</h2></div><a href="https://developers.line.biz/console/" target="_blank" rel="noreferrer">LINE Developers <ExternalLink size={15} /></a></div>
    <Step number={1} title="ฐานข้อมูล Supabase" ready={serverReady}>
      {loadingConfig ? <p className="linev2-result">กำลังตรวจสถานะการเชื่อมต่อ Supabase…</p> : serverReady && !editingServer ? <div className="linev2-connected-profile"><span className="linev2-connected-avatar"><KeyRound size={25} /></span><div><strong>Supabase เชื่อมต่อแล้ว</strong><small>Project URL · Publishable key · Secret key</small><span><Check size={14} /> สถานะล่าสุด · ตรวจสอบอัตโนมัติ · คีย์ลับถูกซ่อน</span></div>{localSaveAvailable && <button type="button" className="linev2-setup-action secondary" onClick={() => setEditingServer(true)}>เปลี่ยน Secret key</button>}</div> : <><p>Project URL และ Publishable key ตั้งไว้ในระบบแล้ว เหลือเพียง Secret key สำหรับบันทึกแชตและข้อมูลสมาชิก</p>
      <div className="linev2-source"><KeyRound size={17} /><span>เอาจาก <b>Supabase Dashboard → Project Settings → API Keys → Secret keys</b> คัดลอกคีย์ที่ขึ้นต้น <code>sb_secret_</code></span></div>
      {localSaveAvailable ? <><label className="linev2-setup-field">Supabase Secret key <small>ใช้เฉพาะฝั่งเซิร์ฟเวอร์ · ไม่ใช่ Channel Secret ของ LINE</small><input type="password" autoComplete="new-password" value={serverSecret} onChange={event => setServerSecret(event.target.value)} placeholder="วาง Secret key ใหม่" /></label><div className="linev2-setup-buttons"><button className="linev2-setup-action" type="button" disabled={busy !== null || !serverSecret || !supabaseConfigured.url || !supabaseConfigured.publishable} onClick={() => void checkSupabase(true)}>เชื่อมและบันทึกใน .env.local</button>{editingServer && <button className="linev2-setup-action secondary" type="button" onClick={() => { setServerSecret(""); setEditingServer(false); }}>ยกเลิก</button>}</div></> : <div className="linev2-urlbox"><strong>เว็บจริงต้องตั้งค่าบน Vercel</strong><small>ใส่ SUPABASE_SECRET_KEY ใน Project Settings → Environment Variables แล้ว Redeploy ระบบจะตรวจสถานะให้อัตโนมัติ คีย์จะไม่แสดงในหน้านี้</small><a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer">เปิด Vercel Dashboard <ExternalLink size={14} /></a></div>}</>}
      {supabaseChecks && !serverReady && <p className="linev2-result error">{!supabaseChecks.url || !supabaseChecks.publishable ? "Project URL หรือ Publishable key ยังไม่พร้อม" : "Secret key ยังไม่ผ่านการตรวจสอบ"}</p>}
      {!localSaveAvailable && !serverReady && <p className="linev2-result">Project URL และ Publishable key ตั้งไว้แล้ว เหลือเพียง Secret key บน Vercel</p>}
      {serverResult && !serverReady && <p className="linev2-result">{serverResult}</p>}{errors.server && <p className="linev2-result error" role="alert">{errors.server}</p>}
      {!serverReady && <small className="linev2-safe-note"><ShieldCheck size={14} /> ค่าลับไม่แสดงบนหน้าเว็บหรือใน Git</small>}
    </Step>
    <Step number={2} title="LINE Messaging API · รับและตอบแชต" ready={Boolean(connection?.connected)} readyText="เชื่อมบัญชีแล้ว">
      {!loadingConfig && (!hasSavedMessaging || editingMessaging) && <p>นำ Channel Secret และ Access Token จาก Messaging API channel มาเชื่อมต่อ</p>}
      {loadingConfig ? <div className="connection-status-pending" role="status">กำลังตรวจสถานะ LINE ที่บันทึกไว้…</div> : hasSavedMessaging && !editingMessaging ? <div className="linev2-connected-profile">{connection?.bot?.pictureUrl ? <Image src={connection.bot.pictureUrl} alt="รูปโปรไฟล์ LINE Official Account" width={56} height={56} unoptimized /> : <span className="linev2-connected-avatar"><SiLine size={26} /></span>}<div><strong>{connection?.bot?.displayName || "บัญชี LINE ที่บันทึกไว้"}</strong><small>{connection?.bot?.basicId || `Channel ID ${connection?.channelId || "ถูกซ่อน"}`}</small><span><Check size={14} /> {connection?.connected ? "ใช้บัญชีที่บันทึกไว้ · อัปเดตสถานะเบื้องหลัง" : "มีค่าที่บันทึกไว้ แต่ LINE ยังตรวจสอบไม่ผ่าน · กรุณาตรวจ Token"}</span></div><button type="button" className="linev2-setup-action secondary" onClick={() => setEditingMessaging(true)}>เปลี่ยนการเชื่อมต่อ</button></div> : <><div className="linev2-setup-fields">
        <label className="linev2-setup-field">Channel Secret <small>แท็บ Basic settings → Channel secret</small><input type="password" autoComplete="new-password" value={messaging.channelSecret} onChange={event => setMessaging({ ...messaging, channelSecret: event.target.value })} placeholder={connection?.channelSecret ? "บันทึกแล้ว · เว้นว่างถ้าไม่เปลี่ยน" : "Channel Secret"} /></label>
        <label className="linev2-setup-field">Channel Access Token <small>แท็บ Messaging API → Channel access token → Issue</small><input type="password" autoComplete="new-password" value={messaging.accessToken} onChange={event => setMessaging({ ...messaging, accessToken: event.target.value })} placeholder={connection?.accessToken ? "บันทึกแล้ว · เว้นว่างถ้าไม่เปลี่ยน" : "Channel Access Token"} /></label>
      </div>
      <details className="linev2-optional"><summary>ข้อมูลเพิ่มเติม · Channel ID (กรอกเฉพาะเมื่อระบบขอ)</summary><label className="linev2-setup-field">Channel ID <small>แท็บ Basic settings → Channel ID</small><input inputMode="numeric" value={messaging.channelId} onChange={event => setMessaging({ ...messaging, channelId: event.target.value })} placeholder="ตัวเลข Channel ID" /></label></details>
      <button className="linev2-setup-action" type="button" disabled={!serverReady || !messaging.channelSecret || !messaging.accessToken || busy !== null} onClick={() => void connectMessaging()}><SiLine /> {busy === "messaging" ? "กำลังเชื่อมและบันทึก…" : "เชื่อมและบันทึก Messaging API"}</button>{editingMessaging && <button className="linev2-setup-action secondary" type="button" onClick={() => setEditingMessaging(false)}>ยกเลิก</button>}</>}
      {connection?.connected && <button className="linev2-setup-action secondary" type="button" disabled={busy !== null} onClick={() => void refresh()}>ตรวจสถานะ</button>}
      {notices.messaging && !connection?.connected && <p className="linev2-result">{notices.messaging}</p>}{errors.messaging && <p className="linev2-result error" role="alert">{errors.messaging}</p>}
      <details className="linev2-optional"><summary>Webhook และลิงก์สำหรับตั้งค่า</summary><div className="linev2-urlbox"><strong>Webhook URL ที่ต้องใส่ในแท็บ Messaging API</strong><code>{webhookUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(webhookUrl)}>คัดลอก URL</button><small>เปิด Use webhook ใน LINE Developers ด้วย {publicUrl ? "· URL นี้เป็น HTTPS" : "· localhost ใช้รับ webhook จริงไม่ได้ ต้อง deploy ก่อน"}</small></div></details>
    </Step>
    <Step number={3} title="LINE Login + LIFF · สมัครและเช็กแต้ม" ready={Boolean(connection?.liff)} readyText="บันทึกแล้ว">
      {connection?.liff && !editingLogin ? <div className="linev2-connected-profile"><span className="linev2-connected-avatar"><Check size={25} /></span><div><strong>LINE Login พร้อมใช้</strong><small>LIFF ID {connection.liffId}</small><span><Check size={14} /> ใช้ค่าที่บันทึกไว้โดยอัตโนมัติ</span></div><button type="button" className="linev2-setup-action secondary" onClick={() => setEditingLogin(true)}>แก้ไข</button></div> : <><p>ใช้ LINE Login channel ใน Provider เดียวกับ Messaging API</p><div className="linev2-setup-fields">
        <label className="linev2-setup-field">LINE Login Channel ID <small>LINE Developers → LINE Login channel → Basic settings → Channel ID · ต้องตรงกับตัวเลขก่อนขีดใน LIFF ID ไม่ใช่ Messaging API Channel ID</small><input inputMode="numeric" value={login.loginChannelId} onChange={event => setLogin({ ...login, loginChannelId: event.target.value })} placeholder="Channel ID ของ LINE Login" /></label>
        <label className="linev2-setup-field">LIFF ID <small>LINE Login channel → แท็บ LIFF → LIFF ID</small><input value={login.liffId} onChange={event => setLogin({ ...login, liffId: event.target.value })} placeholder="เช่น 2000000000-xxxxxxxx" /></label>
      </div>
      <button className="linev2-setup-action" type="button" disabled={!serverReady || !connection?.connected || !login.loginChannelId || !login.liffId || busy !== null} onClick={() => void connectLogin()}>{busy === "login" ? "กำลังบันทึก…" : "เชื่อม LINE Login / LIFF"}</button>{editingLogin && <button type="button" className="linev2-setup-action secondary" onClick={() => setEditingLogin(false)}>ยกเลิก</button>}</>}
      {connection?.liff && <div className="linev2-setup-buttons"><button className="linev2-setup-action secondary" type="button" disabled={busy !== null} onClick={() => void testLogin()}>ทดสอบ LIFF URL</button><a className="linev2-setup-action secondary" href="/customer" target="_blank" rel="noreferrer">เปิดหน้าสมาชิกทดสอบจริง</a></div>}
      {notices.login && !connection?.liff && <p className="linev2-result success">{notices.login}</p>}{errors.login && <p className="linev2-result error" role="alert">{errors.login}</p>}
      <details className="linev2-optional"><summary>ลิงก์เข้าใช้งานสำหรับแอดมินและสมาชิก</summary><div className="linev2-urlbox"><strong>ลิงก์เข้าใช้งานหลัก</strong><small>แอดมิน</small><code>{adminLoginUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(adminLoginUrl)}>คัดลอกลิงก์แอดมิน</button><small>สมาชิก</small><code>{memberLoginUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(memberLoginUrl)}>คัดลอกลิงก์สมาชิก</button></div></details>
      <details className="linev2-optional"><summary>ลิงก์สำหรับตั้งค่า LINE Rich Menu และ LIFF</summary><div className="linev2-urlbox"><strong>Rich Menu ช่อง MEMBERSHIP</strong><code>{richMenuUrl || "เชื่อม LINE Login / LIFF ก่อนเพื่อสร้างลิงก์"}</code><button type="button" disabled={!richMenuUrl} onClick={() => void navigator.clipboard.writeText(richMenuUrl)}>คัดลอกลิงก์ Rich Menu</button><small>ตั้งเป็น URL Action ของปุ่ม MEMBERSHIP ใน LINE Official Account</small></div><div className="linev2-urlbox"><strong>LIFF Endpoint URL</strong><code>{membershipUrl}</code><button type="button" onClick={() => void navigator.clipboard.writeText(membershipUrl)}>คัดลอก Endpoint</button><small>ใช้ตั้งค่าใน LINE Developers เมื่อย้าย Endpoint เท่านั้น ระบบส่งกลับ URL ที่ตั้งไว้ใน LINE โดยอัตโนมัติ</small></div></details>
      <p className="linev2-customer-flow">ลูกค้าเพิ่มเพื่อน OA → กด MEMBERSHIP ใน Rich Menu → LINE Login → สมัครครั้งแรกเพียงครั้งเดียว → เข้าหน้าสมาชิก /customer · เมื่อออกจากระบบให้เข้าด้วย LINE อีกครั้ง</p>
    </Step>
  </div>;
}
