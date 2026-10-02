"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarDays, PawPrint, TicketPercent } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type CouponUsage = { coupon_id: string; title: string; received_count: number; used_count: number };

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

  const received = rows.reduce((total, item) => total + Number(item.received_count), 0);
  const used = rows.reduce((total, item) => total + Number(item.used_count), 0);
  const rate = received ? Math.round(used / received * 100) : 0;
  const items = rows.filter(item => Number(item.received_count) > 0);
  const period = start.slice(0, 7) === end.slice(0, 7) && start.endsWith("-01")
    ? new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(new Date(`${start}T12:00:00Z`))
    : "ช่วงที่เลือก";

  return <section className="panel coupon-usage-panel" aria-labelledby="coupon-usage-title">
    <div className="coupon-usage-heading">
      <PawPrint className="coupon-heading-paw" aria-hidden="true" />
      <div><h2 id="coupon-usage-title">สรุปการใช้คูปอง</h2><p>ผลการใช้สิทธิ์ที่ลูกค้าได้รับในช่วงเวลาที่เลือก</p></div>
      <span className="coupon-period"><CalendarDays size={16} />{period}</span>
    </div>
    {loading ? <p className="coupon-usage-state" role="status">กำลังโหลดข้อมูลคูปอง…</p> : error ? <p className="coupon-usage-state" role="alert">{error}</p> : <>
      <div className="coupon-usage-hero">
        <div className="coupon-usage-illustration"><Image src="/images/coupon-pets.png" alt="สุนัขและแมวกับบัตรคูปอง" width={340} height={255} /></div>
        <div className="coupon-usage-total"><span>ใช้คูปองแล้ว</span><strong>{used.toLocaleString("th-TH")} <small>สิทธิ์</small></strong></div>
        <div className="coupon-usage-rate"><div><span>อัตราการใช้</span><strong>{rate}%</strong></div><div className="coupon-usage-meter" role="progressbar" aria-label="อัตราการใช้คูปอง" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate}><span style={{ width: `${rate}%` }} /></div><p>ใช้แล้ว {used.toLocaleString("th-TH")} จาก {received.toLocaleString("th-TH")} สิทธิ์ที่ลูกค้ารับ</p></div>
      </div>
      <div className="coupon-usage-list"><h3>คูปองแต่ละรายการ</h3>{items.length ? items.map(item => {
        const itemRate = Math.round(Number(item.used_count) / Number(item.received_count) * 100);
        return <div className="coupon-usage-row" key={item.coupon_id}><span className="coupon-row-ticket"><TicketPercent size={18} /></span><strong className="coupon-row-title">{item.title}</strong><span className="coupon-row-count">ใช้แล้ว {Number(item.used_count).toLocaleString("th-TH")} / {Number(item.received_count).toLocaleString("th-TH")} สิทธิ์</span><strong className="coupon-row-rate">{itemRate}%</strong></div>;
      }) : <p className="coupon-usage-empty">ยังไม่มีสิทธิ์คูปองในช่วงเวลานี้</p>}</div>
    </>}
  </section>;
}
