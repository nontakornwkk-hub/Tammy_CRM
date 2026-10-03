"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Check, Link2, RotateCcw, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Transfer = { id: string; status: "waiting" | "claimed"; new_line_display_name: string | null; new_line_picture_url: string | null };

export function MemberLineTransfer({ memberId, memberName, oldLineName, onComplete }: {
  memberId: string; memberName: string; oldLineName: string | null; linked?: boolean; onComplete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    if (!token) throw new Error("กรุณาเข้าสู่ระบบแอดมินใหม่");
    const response = await fetch(`/api/line/messaging/member-transfer?memberId=${encodeURIComponent(memberId)}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
    });
    const data = await response.json() as { transfer?: Transfer | null; error?: string };
    if (!response.ok) throw new Error(data.error || "โหลดคำขอไม่สำเร็จ");
    setTransfer(data.transfer || null);
  }, [memberId]);

  useEffect(() => {
    if (!open) return;
    void load().catch(cause => setError(cause instanceof Error ? cause.message : "โหลดคำขอไม่สำเร็จ"));
    const timer = window.setInterval(() => {
      void load().catch(() => { /* Show the last known state until the next refresh. */ });
    }, 4000);
    return () => window.clearInterval(timer);
  }, [open, load]);

  useEffect(() => {
    if (!transfer || !open) { setQr(""); setUrl(""); return; }
    let active = true;
    void (async () => {
      const response = await fetch("/api/line/member/config", { cache: "no-store" });
      const config = await response.json() as { liffId?: string };
      if (!config.liffId) throw new Error("ยังไม่ได้ตั้งค่า LIFF สำหรับลูกค้า");
      const link = `https://liff.line.me/${encodeURIComponent(config.liffId)}/?lineTransfer=${encodeURIComponent(transfer.id)}`;
      const { default: QRCode } = await import("qrcode");
      const image = await QRCode.toDataURL(link, { width: 400, margin: 2, errorCorrectionLevel: "M" });
      if (active) { setUrl(link); setQr(image); }
    })().catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "สร้าง QR ไม่สำเร็จ"); });
    return () => { active = false; };
  }, [transfer?.id, transfer?.status, open]);

  async function act(action: "start" | "cancel" | "complete") {
    setBusy(true); setError("");
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("กรุณาเข้าสู่ระบบแอดมินใหม่");
      const response = await fetch("/api/line/messaging/member-transfer", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, memberId, requestId: transfer?.id }), cache: "no-store",
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
      if (action === "complete") { setOpen(false); setConfirming(false); onComplete(); }
      else await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ดำเนินการไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" className="member-line-transfer-trigger" onClick={() => { setError(""); setOpen(true); }}><Link2 size={15} /> เปลี่ยน LINE</button>
    {open ? <div className="preview-modal member-line-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="member-line-transfer-title">
      <button type="button" className="preview-backdrop" aria-label="ปิดหน้าต่าง" onClick={() => setOpen(false)} />
      <section className="member-line-transfer-card">
        <button className="member-line-transfer-close" type="button" aria-label="ปิด" onClick={() => setOpen(false)}><X size={19} /></button>
        <span className="member-line-transfer-kicker">การเชื่อมต่อ LINE</span>
        <h2 id="member-line-transfer-title">เปลี่ยน LINE ของ {memberName}</h2>
        <p>ตรวจตัวลูกค้าที่หน้าร้านก่อนเริ่ม แล้วให้ลูกค้าใช้ LINE ใหม่สแกน QR นี้ การสแกนยังไม่เปลี่ยนบัญชีจนกว่าร้านจะยืนยัน</p>
        <div className="member-line-transfer-compare"><span>LINE เดิม<strong>{oldLineName || "ยังไม่เชื่อม"}</strong></span><span aria-hidden="true">→</span><span>LINE ใหม่<strong>{transfer?.new_line_display_name || "รอลูกค้าสแกน"}</strong></span></div>
        {!transfer ? <button className="member-line-transfer-start" type="button" disabled={busy} onClick={() => void act("start")}>สร้าง QR สำหรับ LINE ใหม่</button> : <>
          {qr && transfer.status === "waiting" ? <div className="member-line-transfer-qr"><Image src={qr} width={200} height={200} alt="QR สำหรับเชื่อม LINE ใหม่" unoptimized /><small>QR ใช้ได้ครั้งเดียวจนกว่าจะยกเลิกคำขอ</small></div> : null}
          {transfer.status === "claimed" ? <div className="member-line-transfer-ready"><Check size={18} /> ลูกค้าสแกนและยืนยัน LINE ใหม่แล้ว ตรวจชื่อก่อนดำเนินการ</div> : <p className="member-line-transfer-wait"><RotateCcw size={14} /> รอลูกค้าเปิดด้วย LINE ใหม่</p>}
          {transfer.status === "waiting" && url ? <button className="member-line-transfer-copy" type="button" onClick={() => void navigator.clipboard.writeText(url)}>คัดลอกลิงก์ให้ลูกค้า</button> : null}
          {confirming ? <div className="member-line-transfer-confirm"><strong>ยืนยันย้ายการเชื่อม LINE?</strong><p>LINE เดิมจะเข้าบัญชีนี้ไม่ได้อีก แต้ม ประวัติ และคูปองยังอยู่กับสมาชิกคนเดิม</p><div><button type="button" onClick={() => setConfirming(false)}>กลับ</button><button type="button" disabled={busy} onClick={() => void act("complete")}>ยืนยันเปลี่ยน LINE</button></div></div> : null}
          <div className="member-line-transfer-actions"><button type="button" disabled={busy} onClick={() => void act("cancel")}>ยกเลิกคำขอ</button>{transfer.status === "claimed" && !confirming ? <button type="button" disabled={busy} onClick={() => setConfirming(true)}>ตรวจแล้ว ดำเนินการต่อ</button> : null}</div>
        </>}
        {error ? <p className="member-line-transfer-error" role="alert">{error}</p> : null}
      </section>
    </div> : null}
  </>;
}
