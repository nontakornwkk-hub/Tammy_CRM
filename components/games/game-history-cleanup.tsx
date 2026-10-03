"use client";
import { useState } from "react";
import { Download, Trash2, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function GameHistoryCleanup({ onCleared }: { onCleared: () => void }) {
  const currentYear = Number(new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date()));
  const [mode, setMode] = useState<"backup" | "clear" | null>(null);
  const [year, setYear] = useState(String(currentYear));
  const [busy, setBusy] = useState<"backup" | "clear" | null>(null);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [count, setCount] = useState(0);
  const [confirmation, setConfirmation] = useState("");
  function chooseYear(value: string) { setYear(value); setReceipt(""); setCount(0); setConfirmation(""); setError(""); }
  function close() { if (!busy) { setMode(null); setError(""); } }
  async function request(method = "GET", download = false) {
    const session = await supabase?.auth.getSession();
    if (!session?.data.session) throw new Error("กรุณาเข้าสู่ระบบ");
    const response = await fetch(`/api/admin/games/history/archive?year=${year}${download ? "&download=1" : ""}`, { method, headers: { Authorization: `Bearer ${session.data.session.access_token}`, "Content-Type": "application/json" }, ...(method === "DELETE" ? { body: JSON.stringify({ receipt, confirmation }) } : {}), cache: "no-store" });
    if (!response.ok) throw new Error((await response.json()).error || "เชื่อมต่อไม่สำเร็จ");
    return response;
  }
  async function backup() {
    setBusy("backup"); setError(""); setReceipt(""); setCount(0);
    try {
      const response = await request("GET", true);
      const blob = await response.blob();
      const token = response.headers.get("X-Archive-Receipt") || "";
      const total = Number(response.headers.get("X-Archive-Count") || 0);
      if (total > 0 && !token) throw new Error("ไฟล์สำรองไม่สมบูรณ์");
      const url = URL.createObjectURL(blob), link = document.createElement("a");
      link.href = url; link.download = `tammy-game-history-${year}.xlsx`; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setReceipt(token); setCount(total);
      setError(total ? `ดาวน์โหลดไฟล์สำรอง ${total.toLocaleString()} รายการแล้ว กรุณาตรวจไฟล์ก่อนล้าง` : "ดาวน์โหลดไฟล์สำรองแล้ว · ช่วงนี้ยังไม่มีประวัติเล่น");
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  async function clear() {
    setBusy("clear"); setError("");
    try {
      const response = await request("DELETE"); const result = await response.json();
      setReceipt(""); setConfirmation(""); setCount(0);
      setError(`ล้างแล้ว ${result.deleted.toLocaleString()} รายการ · สิทธิ์เล่นและรางวัลคงอยู่`);
      onCleared();
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  return <>
    <div className="game-cleanup-actions">
      <button type="button" className="game-cleanup-open" onClick={() => { setMode("backup"); setError(""); }}><Download size={16} /> สำรองประวัติ</button>
      <button type="button" className="game-cleanup-open game-cleanup-open-danger" onClick={() => { setMode("clear"); setError(""); }}><Trash2 size={16} /> ล้างประวัติ</button>
    </div>
    {mode && <div className="preview-modal game-history-modal" role="dialog" aria-modal="true" aria-labelledby="game-cleanup-title">
      <button className="preview-backdrop" disabled={!!busy} aria-label="ปิด" onClick={close} />
      <section className="game-cleanup-panel">
        <button className="preview-close" disabled={!!busy} aria-label="ปิด" onClick={close}><X size={19} /></button>
        <div className="game-cleanup-heading"><span className={mode === "clear" ? "danger" : ""}>{mode === "backup" ? <Download size={22} /> : <Trash2 size={22} />}</span><div><small>ประวัติการเล่นเกม</small><h2 id="game-cleanup-title">{mode === "backup" ? "สำรองประวัติ" : "ล้างประวัติ"}</h2></div></div>
        <p className="game-cleanup-description">{mode === "backup" ? "ดาวน์โหลดไฟล์ Excel แยกแท็บตามเดือน ใช้สำรองได้แม้ช่วงที่เลือกยังไม่มีรายการ" : "ล้างเฉพาะประวัติการเล่น ตั๋วคงเหลือ แต้ม และรางวัลของลูกค้ายังคงอยู่"}</p>
        <label className="game-cleanup-field">ช่วงเวลาที่ต้องการ{mode === "backup" ? "สำรอง" : "ล้าง"}<select value={year} disabled={!!busy} onChange={e => chooseYear(e.target.value)}><option value="all">ประวัติทั้งหมด</option>{Array.from({ length: currentYear - 2019 }, (_, i) => currentYear - i).map(y => <option key={y} value={y}>ปี {y + 543}</option>)}</select></label>
        {mode === "backup" ? <><button className="game-cleanup-primary" disabled={!!busy} onClick={() => void backup()}><Download size={17} />{busy === "backup" ? "กำลังสร้างไฟล์…" : "ดาวน์โหลด Excel"}</button><small className="game-cleanup-note">ไฟล์ .xlsx จะมีแท็บแยกตามเดือน ข้อมูลถึงเวลาที่เริ่มสำรอง</small></> : <>
          <div className="game-cleanup-step"><b>1</b><div><strong>สำรองก่อนล้าง</strong><small>ดาวน์โหลดและตรวจไฟล์ที่บันทึกไว้ก่อนยืนยัน</small></div></div>
          <button className="game-cleanup-secondary" disabled={!!busy} onClick={() => void backup()}><Download size={17} />{busy === "backup" ? "กำลังสร้างไฟล์…" : receipt ? `สำรองแล้ว ${count.toLocaleString()} รายการ · ดาวน์โหลดใหม่` : "ดาวน์โหลดไฟล์สำรอง"}</button>
          <div className="game-cleanup-confirm"><div className="game-cleanup-step"><b>2</b><div><strong>{receipt ? `ยืนยันการล้าง ${count.toLocaleString()} รายการ` : "ยืนยันการล้างประวัติ"}</strong><small>{receipt ? "รายการใหม่หลังเริ่มสำรองจะไม่ถูกล้าง" : "ปุ่มจะพร้อมหลังดาวน์โหลดไฟล์สำรองที่มีรายการ"}</small></div></div><label>พิมพ์ “ล้างประวัติ” เพื่อยืนยัน<input value={confirmation} disabled={!!busy || !receipt} onChange={e => setConfirmation(e.target.value)} /></label><button className="game-cleanup-primary danger" disabled={!!busy || !receipt || confirmation !== "ล้างประวัติ"} onClick={() => void clear()}><Trash2 size={17} />{busy === "clear" ? "กำลังล้าง…" : "ยืนยันล้างประวัติ"}</button></div>
        </>}
        {error && <p className="game-cleanup-feedback" role="status">{error}</p>}
      </section>
    </div>}
  </>;
}
