"use client";

import { useEffect, useState } from "react";
import { Check, ChevronDown, ClipboardCopy, Link2, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Integration = { configured: boolean; publicReady: boolean; baseUrl: string };

async function readIntegration<T>(reveal = false): Promise<T> {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
  const response = await fetch("/api/pos/integration", {
    method: reveal ? "POST" : "GET",
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(reveal ? { body: JSON.stringify({ action: "reveal" }) } : {}),
  });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "อ่านข้อมูลเชื่อมต่อไม่สำเร็จ");
  return data;
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return; }
    catch { /* Some mobile browsers need the selection fallback. */ }
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("คัดลอกไม่สำเร็จ");
}

export function PosConnectionCard() {
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    void readIntegration<Integration>().then(data => { if (current) setIntegration(data); })
      .catch(cause => { if (current) setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ"); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  const baseUrl = integration?.baseUrl || "";
  const memberPath = "/api/pos/v1/members?memberCode=YOUR_MEMBER_CODE";
  const salePath = "/api/pos/v1/sales";
  const exampleSale = { externalSaleId: "YOUR_RECEIPT_ID", memberCode: "YOUR_MEMBER_CODE", saleAmount: "259.50" };

  async function copyConnection() {
    if (!integration?.configured || busy) return;
    setBusy(true); setError("");
    try {
      const { apiKey } = await readIntegration<{ apiKey: string }>(true);
      const kit = [
        "Tammy CRM · POS API v1",
        `Base URL: ${baseUrl}`,
        `API Key: ${apiKey}`,
        `Authorization: Bearer ${apiKey}`,
        "",
        `ค้นหาสมาชิก: GET ${baseUrl}${memberPath}`,
        `บันทึกบิล: POST ${baseUrl}${salePath}`,
        "Content-Type: application/json",
        `ตัวอย่างข้อมูลบิล: ${JSON.stringify(exampleSale)}`,
        "",
        "เปลี่ยน YOUR_MEMBER_CODE และ YOUR_RECEIPT_ID ก่อนใช้งานจริง",
        "ส่งเลขบิลเดิมเมื่อ retry เพื่อไม่ให้แต้มเพิ่มซ้ำ",
      ].join("\n");
      await copyText(kit);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 3000);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "คัดลอกไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return <section className="pos-simple" aria-label="เชื่อมต่อ POS API">
    <div className="pos-simple-hero"><span className="pos-simple-icon"><Link2 size={25} /></span><div><small>เชื่อมต่อระบบขายหน้าร้าน</small><h2>POS API</h2><p>คัดลอกข้อมูลครบชุด แล้วนำไปใส่ในระบบ POS ได้เลย</p></div></div>
    <div className="pos-simple-steps"><div><b>1</b><span>กดคัดลอกข้อมูลเชื่อมต่อ</span></div><div><b>2</b><span>ส่งให้คนทำ POS หรือวางในระบบ POS ฝั่งเซิร์ฟเวอร์</span></div></div>
    <div className="pos-simple-primary"><div><small>URL สำหรับระบบ POS</small><strong>{baseUrl || (loading ? "กำลังโหลด..." : "ยังไม่มีข้อมูล")}</strong><span><ShieldCheck size={15} /> ใช้ URL ของเว็บจริง</span></div><button type="button" disabled={loading || busy || !integration?.configured} onClick={() => void copyConnection()}>{copied ? <Check size={19} /> : <ClipboardCopy size={19} />}{copied ? "คัดลอกแล้ว" : busy ? "กำลังคัดลอก..." : "คัดลอกชุดเชื่อมต่อ"}</button></div>
    {!loading && integration && !integration.configured && <p className="pos-simple-alert">ยังไม่ได้ตั้งค่า POS_API_KEY บนเซิร์ฟเวอร์ CRM จึงยังคัดลอกคีย์ไม่ได้</p>}
    {!loading && integration?.configured && !integration.publicReady && <p className="pos-simple-alert">ข้อมูลพร้อมคัดลอก แต่ POS API บนเว็บจริงยังไม่เปิดใช้งาน ต้องเผยแพร่โค้ดและตั้งคีย์บนเว็บจริงก่อนเชื่อมต่อ</p>}
    {error && <p className="pos-simple-alert" role="alert">{error}</p>}
    <p className="pos-simple-security">ข้อมูลที่คัดลอกมี API Key ซึ่งต้องตรงกับค่า POS_API_KEY บนเว็บจริง ให้เก็บไว้เฉพาะใน POS ฝั่งเซิร์ฟเวอร์</p>
    <details className="pos-simple-details"><summary>ดูรายละเอียด API <ChevronDown size={17} /></summary><div><p><b>ค้นหาสมาชิก</b><code>GET {baseUrl}{memberPath}</code>เปลี่ยนรหัสสมาชิก หรือใช้ <code>phone=0812345678</code> แทน</p><p><b>บันทึกบิล</b><code>POST {baseUrl}{salePath}</code>ระบบคำนวณแต้มและแรงค์ให้อัตโนมัติ ส่งเลขบิลเดิมซ้ำได้โดยแต้มไม่เพิ่มซ้ำ</p><p><b>ตัวอย่าง JSON</b><pre>{JSON.stringify(exampleSale, null, 2)}</pre></p><p className="pos-simple-result">ผลลัพธ์: <b>201</b> บิลใหม่ · <b>200</b> บิลเดิม · <b>404</b> ไม่พบสมาชิก · <b>409</b> เลขบิลซ้ำแต่ข้อมูลต่างกัน</p></div></details>
  </section>;
}
