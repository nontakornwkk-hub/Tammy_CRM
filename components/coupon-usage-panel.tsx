"use client";

import { useEffect, useState } from "react";
import { TicketPercent } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type CouponUsage = { coupon_id: string; title: string; opened_count: number; used_count: number; expired_count: number };

export function CouponUsagePanel({ start, end, reload }: { start: string; end: string; reload: number }) {
  const [rows, setRows] = useState<CouponUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true); setError("");
      try {
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;
        if (!token) throw new Error("กรุณาเข้าสู่ระบบใหม่");
        const url = `/api/line/messaging/coupon-analytics?${new URLSearchParams({ start, end })}`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        const result = await response.json() as { rows?: CouponUsage[]; error?: string };
        if (!response.ok) throw new Error(result.error || "โหลดรายงานคูปองไม่สำเร็จ");
        if (!controller.signal.aborted) setRows(result.rows || []);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "โหลดรายงานคูปองไม่สำเร็จ");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [start, end, reload]);

  const opened = rows.reduce((total, item) => total + Number(item.opened_count), 0);
  const used = rows.reduce((total, item) => total + Number(item.used_count), 0);
  const expired = rows.reduce((total, item) => total + Number(item.expired_count), 0);
  const rate = opened ? Math.round(used / opened * 100) : 0;
  return <section className="panel coupon-usage-panel" aria-labelledby="coupon-usage-title">
    <div className="coupon-usage-heading"><span><TicketPercent size={23} /></span><div><h2 id="coupon-usage-title">อัตราการใช้คูปอง</h2><p>นับจาก QR ที่ลูกค้ายืนยันเปิดในช่วงวันที่เลือก</p></div></div>
    {loading ? <p role="status">กำลังโหลดข้อมูลคูปอง…</p> : error ? <p role="alert">{error}</p> : <>
      <div className="coupon-usage-numbers"><div><small>เปิด QR</small><strong>{opened.toLocaleString("th-TH")}</strong><span>สิทธิ์</span></div><div className="is-used"><small>ใช้สำเร็จ</small><strong>{used.toLocaleString("th-TH")}</strong><span>สิทธิ์</span></div><div><small>อัตราการใช้</small><strong>{rate}%</strong><span>ของ QR ที่เปิด</span></div></div>
      <div className="coupon-usage-meter" role="progressbar" aria-label="อัตราการใช้คูปอง" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate}><span style={{ width: `${rate}%` }} /></div>
      <p className="coupon-usage-explain">{opened ? `หมดเวลาโดยไม่ใช้ ${expired.toLocaleString("th-TH")} สิทธิ์` : "ยังไม่มีการเปิด QR คูปองในช่วงนี้"}</p>
      {rows.some(item => Number(item.opened_count) > 0) && <div className="coupon-usage-list">{rows.filter(item => Number(item.opened_count) > 0).slice(0, 5).map(item => <div key={item.coupon_id}><span>{item.title}</span><strong>{item.used_count}/{item.opened_count} ใช้แล้ว</strong></div>)}</div>}
    </>}
  </section>;
}
