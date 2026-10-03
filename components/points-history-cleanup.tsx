"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Preview = { year: number; count: number };
type DeleteResult = { deleted: number; remaining: number; error?: string };

async function historyRequest(path: string, init?: RequestInit) {
  const session = await supabase?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  const response = await fetch(path, { ...init, cache: "no-store", headers: { Authorization: `Bearer ${token}`, ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || "ดำเนินการไม่สำเร็จ");
  }
  return response;
}

export function PointsHistoryCleanup({ onDeleted }: { onDeleted: () => void }) {
  const thisYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()));
  const years = Array.from({ length: Math.max(0, Math.min(10, thisYear - 2020)) }, (_, index) => thisYear - index - 1);
  const [year, setYear] = useState(years[0] || 0);
  const activeYear = useRef(year);
  activeYear.current = year;
  const [preview, setPreview] = useState<Preview | null>(null);
  const [archivedYear, setArchivedYear] = useState<number | null>(null);
  const [archivedCount, setArchivedCount] = useState(0);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState<"preview" | "download" | "delete" | null>(null);
  const [deleted, setDeleted] = useState(0);
  const [error, setError] = useState("");

  const loadPreview = useCallback(async (targetYear: number) => {
    if (!targetYear) return;
    setBusy("preview"); setError("");
    try {
      const response = await historyRequest(`/api/admin/points-history?year=${targetYear}`);
      const next = await response.json() as Preview;
      if (activeYear.current === targetYear) setPreview(next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "นับรายการไม่สำเร็จ"); }
    finally { setBusy(null); }
  }, []);

  useEffect(() => { void loadPreview(year); }, [year, loadPreview]);

  async function download() {
    if (!preview?.count || preview.year !== year || busy) return;
    setBusy("download"); setError(""); setArchivedYear(null);
    try {
      const response = await historyRequest(`/api/admin/points-history?year=${year}&download=1`);
      const blob = await response.blob();
      const current = await historyRequest(`/api/admin/points-history?year=${year}`);
      const verified = await current.json() as Preview;
      if (verified.count !== preview.count) throw new Error("จำนวนรายการเปลี่ยนระหว่างสำรอง กรุณาดาวน์โหลดใหม่");
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `tammy-points-history-${year}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
      setArchivedYear(year);
      setArchivedCount(verified.count);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ดาวน์โหลดไม่สำเร็จ"); }
    finally { setBusy(null); }
  }

  async function remove() {
    if (!preview?.count || preview.year !== year || archivedYear !== year || archivedCount < preview.count || confirmation !== `ลบ ${year}` || busy) return;
    setBusy("delete"); setError(""); setDeleted(0);
    let remaining = preview.count;
    try {
      while (remaining > 0) {
        const response = await historyRequest("/api/admin/points-history", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ year, expectedCount: remaining, confirmation }),
        });
        const result = await response.json() as DeleteResult;
        if (!result.deleted) throw new Error("ไม่มีรายการถูกลบ กรุณาตรวจสถานะใหม่");
        remaining = result.remaining;
        setDeleted(current => current + result.deleted);
        setPreview({ year, count: remaining });
      }
      setConfirmation("");
      onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ลบประวัติไม่สำเร็จ");
      void loadPreview(year);
      onDeleted();
    } finally { setBusy(null); }
  }

  return <section className="points-cleanup" aria-labelledby="points-cleanup-title">
    <div className="points-cleanup-heading"><div><h3 id="points-cleanup-title">สำรองและลบประวัติแต้มปีก่อน</h3><p>เลือกปี ดาวน์โหลด CSV ให้เสร็จ แล้วจึงยืนยันการลบ</p></div></div>
    <div className="points-cleanup-controls"><label>ปีที่ต้องการจัดการ <select value={year} disabled={busy === "delete"} onChange={event => { setYear(Number(event.target.value)); setPreview(null); setArchivedYear(null); setConfirmation(""); setDeleted(0); }}>{years.map(value => <option key={value} value={value}>{value + 543} (พ.ศ.)</option>)}</select></label><span>{busy === "preview" ? "กำลังนับ…" : `${(preview?.year === year ? preview.count : 0).toLocaleString()} รายการที่ลบได้`}</span></div>
    <p className="points-cleanup-note">ระบบเก็บรายการปีปัจจุบันไว้สำหรับคำนวณรีเซ็ตแต้ม และเก็บรายการโบนัสเลื่อนระดับไว้ป้องกันการให้โบนัสซ้ำ ยอดแต้มปัจจุบันของสมาชิกไม่เปลี่ยน แต่รายงานย้อนหลังจะไม่แสดงรายการที่ลบ</p>
    <div className="points-cleanup-actions"><button type="button" disabled={!preview?.count || preview.year !== year || busy !== null} onClick={() => void download()}><Download size={16} /> {busy === "download" ? "กำลังเตรียมไฟล์…" : `ดาวน์โหลด CSV ปี ${year + 543}`}</button>{archivedYear === year && <span role="status">ส่งไฟล์สำรองให้เบราว์เซอร์แล้ว</span>}</div>
    {archivedYear === year && preview?.year === year && preview.count ? <div className="points-cleanup-confirm"><label>พิมพ์ <strong>ลบ {year}</strong> เพื่อยืนยัน<input value={confirmation} onChange={event => setConfirmation(event.target.value)} placeholder={`ลบ ${year}`} disabled={busy === "delete"} /></label><button type="button" className="danger" disabled={busy !== null || confirmation !== `ลบ ${year}` || archivedCount < preview.count} onClick={() => void remove()}><Trash2 size={16} /> {busy === "delete" ? "กำลังลบ…" : "ลบประวัติปีนี้"}</button></div> : null}
    {deleted > 0 && <p className="points-cleanup-progress" role="status">ลบแล้ว {deleted.toLocaleString()} รายการ{preview?.count ? ` · เหลือ ${preview.count.toLocaleString()} รายการ` : ""}</p>}
    {error && <p className="database-usage-error" role="alert">{error}</p>}
    <p className="points-cleanup-note">ควรจัดการก่อนพื้นที่เต็ม หาก Supabase เข้าโหมดอ่านอย่างเดียว ปุ่มลบจะทำงานไม่ได้ และหลังลบพื้นที่ที่แสดงอาจยังไม่ลดทันทีจนกว่าฐานข้อมูลจะ vacuum</p>
  </section>;
}
