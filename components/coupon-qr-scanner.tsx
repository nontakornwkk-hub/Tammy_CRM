"use client";

import { Camera, Check, Keyboard, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { notifyCatalogChanged } from "@/lib/catalog-live";
import { supabase } from "@/lib/supabase/client";
import { memberScannerKey, normalizeGameScan, normalizeMemberScan } from "@/lib/member-code";
import { ProfilePhoto } from "./profile-photo";

type Claim = { expiresAt?:string; kind?:string; status: string; member: { name: string; member_code: string; line_picture_url: string | null }; coupon: { title: string; discount_type: string; discount_value: number; min_spend: number } };

export function CouponQrScanner({ onClose, initialQr = "" }: { onClose: () => void; initialQr?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [qr, setQr] = useState(initialQr);
  const [claim, setClaim] = useState<Claim | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [cameraStatus, setCameraStatus] = useState("กำลังเปิดกล้อง…");
  const [retry, setRetry] = useState(0);
  const [sale,setSale]=useState(0);
  const qrRef = useRef(initialQr);
  const scanRef = useRef<(value: string) => void>(() => {});
  scanRef.current = value => { qrRef.current = value; setQr(value); void inspect(value); };
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (initialQr) void inspect(initialQr); }, [initialQr]);

  function updateQr(value: string) { qrRef.current = value; setQr(value); }
  function scannerKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") { event.preventDefault(); void inspect(qrRef.current); return; }
    if (event.key === "Backspace") { event.preventDefault(); updateQr(qrRef.current.slice(0, -1)); return; }
    const letter = memberScannerKey(event.code) || (event.code === "Minus" ? "-" : event.code === "Semicolon" && event.shiftKey ? ":" : null);
    if (letter) { event.preventDefault(); updateQr(qrRef.current + letter); }
  }

  useEffect(() => {
    let scanner: import("qr-scanner").default | null = null;
    let active = true;
    const video = videoRef.current;
    if (!video) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setCameraStatus("เปิดผ่าน HTTPS เพื่อใช้กล้อง หรือสแกนด้วยเครื่องอ่านด้านล่าง"); return; }
    void (async () => {
      try {
        const { default: QrScanner } = await import("qr-scanner");
        if (!active) return;
        scanner = new QrScanner(video, result => { if (active) { scanRef.current(result.data); scanner?.stop(); } }, { preferredCamera: "environment", maxScansPerSecond: 8, returnDetailedScanResult: true });
        await scanner.start();
        if (active) setCameraStatus("หันกล้องไปที่ QR คูปองหรือรางวัลของลูกค้า");
      } catch { if (active) setCameraStatus("เปิดกล้องไม่สำเร็จ ใช้เครื่องสแกนหรือกรอก QR ด้านล่าง"); }
    })();
    return () => { active = false; scanner?.destroy(); };
  }, [retry]);

  async function call(action: "inspect" | "redeem", value: string) {
    if (!supabase) throw new Error("ยังไม่ได้เชื่อมฐานข้อมูล");
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) throw new Error("กรุณาเข้าสู่ระบบพนักงาน");
    const gameQr=normalizeGameScan(value);
    const response = await fetch(gameQr?"/api/admin/games":"/api/line/messaging/coupon-redemption", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(gameQr?{action,token:gameQr,saleAmount:sale}:{ action, qr: value }), cache: "no-store" });
    const data = await response.json() as { claim?: Claim; success?: boolean; error?: string; grant?:{title:string;kind:string;status:string;expires_at:string;snapshot:{discountType:string;discountValue:number;minSpend:number}};member?:Claim["member"] };
    if (!response.ok) throw new Error(data.error || "ตรวจคูปองไม่สำเร็จ");
    if(gameQr&&data.grant&&data.member){const grant=data.grant;data.claim={status:grant.status,kind:grant.kind,expiresAt:grant.expires_at,member:{...data.member,member_code:data.member.member_code||"รางวัลจากเกม"},coupon:{title:grant.title,discount_type:grant.snapshot.discountType,discount_value:grant.snapshot.discountValue,min_spend:grant.snapshot.minSpend}};}
    return data;
  }

  async function inspect(value: string) {
    if(/^TAMMY-MEMBER:/i.test(value.trim())||/^TM[A-Z0-9]{4,}$/i.test(value.trim())){window.location.assign(`/points?scan=${encodeURIComponent(normalizeMemberScan(value))}`);return;}
    if (busy) return;
    setBusy(true); setError(""); setClaim(null); setDone(false); setSale(0);
    try { const data = await call("inspect", value); setClaim(data.claim || null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ตรวจคูปองไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function redeem() {
    if (!claim || busy) return;
    setBusy(true); setError("");
    try { await call("redeem", qr); setDone(true); notifyCatalogChanged(); setClaim({ ...claim, status: "used" }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ใช้สิทธิ์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void inspect(qrRef.current); }

  return <div className="preview-modal member-qr-modal coupon-scan-modal" role="dialog" aria-modal="true" aria-labelledby="coupon-qr-title">
    <button className="preview-backdrop" type="button" aria-label="ปิดสแกนคูปอง" onClick={onClose} />
    <section><button className="preview-close" type="button" onClick={onClose} aria-label="ปิด"><X /></button>
      <h2 id="coupon-qr-title"><Camera size={22} /> สแกนสมาชิก / คูปอง / รางวัล</h2><p>สแกนสมาชิกเพื่อให้แต้ม หรือสแกนคูปองและรางวัลเกมเพื่อตรวจแล้วกดยืนยัน</p>
      {initialQr && retry === 0 ? null : <div className="member-qr-video"><video ref={videoRef} muted playsInline autoPlay aria-label="ภาพจากกล้องสำหรับสแกนคูปอง" /></div>}
      <p className="member-qr-status" role="status">{cameraStatus}</p><button type="button" className="member-qr-retry" onClick={() => { setClaim(null); setDone(false); setError(""); setRetry(value => value + 1); }}><RotateCcw size={15} /> สแกนอีกครั้ง</button>
      <form onSubmit={submit}><label htmlFor="coupon-qr-input"><Keyboard size={17} /> เครื่องสแกน QR หรือวางข้อมูล QR</label><div><input ref={inputRef} id="coupon-qr-input" value={qr} onChange={event => updateQr(event.target.value)} onKeyDown={scannerKey} placeholder="TAMMY-COUPON:… หรือ TAMMY-GAME:…" autoComplete="off" spellCheck={false} /><button type="submit" disabled={busy}>ตรวจรางวัล</button></div></form>
      {claim ? <div className="coupon-scan-result"><div className="coupon-scan-member"><span className="coupon-scan-avatar"><ProfilePhoto src={claim.member.line_picture_url} size={58} alt={`รูปโปรไฟล์ของ ${claim.member.name}`} /></span><span><strong>{claim.member.name}</strong><small>{claim.member.member_code}</small></span></div><div className="coupon-scan-offer"><h3>{claim.coupon.title}</h3>{claim.kind!=="item"&&<strong>{claim.coupon.discount_type === "percent" ? `ลด ${Number(claim.coupon.discount_value).toLocaleString("th-TH")}%` : `ลด ${Number(claim.coupon.discount_value).toLocaleString("th-TH")} บาท`}</strong>}{Number(claim.coupon.min_spend) > 0 && <small>เมื่อซื้อครบ {Number(claim.coupon.min_spend).toLocaleString("th-TH")} บาท</small>}</div>{claim.expiresAt&&<small>หมดอายุ {new Date(claim.expiresAt).toLocaleString("th-TH")}</small>}{claim.kind==="coupon"&&<label className="game-scan-sale">ยอดซื้อ (บาท)<input type="number" min={0} step="0.01" value={sale} disabled={busy||done} onChange={e=>setSale(Number(e.target.value))}/></label>}{claim.expiresAt&&Date.parse(claim.expiresAt)<=Date.now()?<b>รางวัลหมดอายุแล้ว</b>:done ? <b className="coupon-scan-done"><Check size={18} /> ใช้สิทธิ์สำเร็จแล้ว</b> : claim.status === "used" ? <b>คูปองนี้ใช้ไปแล้ว</b> : <button className="button primary" type="button" disabled={busy||claim.kind==="coupon"&&sale<claim.coupon.min_spend} onClick={() => void redeem()}>{busy ? "กำลังยืนยัน…" : "ยืนยันใช้สิทธิ์"}</button>}</div> : null}
      {error ? <p className="rewards-gallery-error" role="alert">{error}</p> : null}
    </section>
  </div>;
}
