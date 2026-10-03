"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarDays, ChevronDown, PawPrint, TicketPercent } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { crmOwnerId } from "@/lib/supabase/crm-data";

type CouponUsage = { coupon_id: string; title: string; received_count: number; used_count: number };
const snapshots = new Map<string, CouponUsage[]>();

export function CouponUsagePanel({ start, end, reload }: { start: string; end: string; reload: number }) {
  const ownerId = crmOwnerId();
  const scope = `${ownerId}:${start}:${end}`;
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<{ scope: string; rows: CouponUsage[] } | null>(() => {
    const cached = snapshots.get(scope);
    return cached ? { scope, rows: cached } : null;
  });
  const [error, setError] = useState("");
  const [live, setLive] = useState(false);
  const rows = snapshot?.scope === scope ? snapshot.rows : snapshots.get(scope) ?? [];
  const loading = snapshot?.scope !== scope && !snapshots.has(scope);

  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    let pending = false;
    let debounce: ReturnType<typeof setTimeout>;
    setError(""); setLive(false);
    const refresh = async () => {
      if (controller.signal.aborted || document.visibilityState === "hidden") return;
      if (running) { pending = true; return; }
      running = true;
      try {
        const session = await supabase?.auth.getSession();
        const token = session?.data.session?.access_token;
        if (!token) throw new Error("กรุณาเข้าสู่ระบบใหม่");
        const response = await fetch(`/api/line/messaging/coupon-analytics?${new URLSearchParams({ start, end })}`, {
          headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal,
        });
        const result = await response.json() as { rows?: CouponUsage[]; error?: string };
        if (!response.ok) throw new Error(result.error || "อัปเดตรายงานคูปองไม่สำเร็จ");
        if (!controller.signal.aborted) {
          const next = result.rows || [];
          snapshots.set(scope, next);
          if (snapshots.size > 12) snapshots.delete(snapshots.keys().next().value!);
          setSnapshot({ scope, rows: next }); setError("");
        }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "อัปเดตรายงานคูปองไม่สำเร็จ");
      } finally {
        running = false;
        if (pending && !controller.signal.aborted) { pending = false; void refresh(); }
      }
    };
    const schedule = () => { clearTimeout(debounce); debounce = setTimeout(() => void refresh(), 250); };
    const channel = ownerId ? supabase?.channel(`coupon-usage:${ownerId}:${start}:${end}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_live_updates", filter: `owner_id=eq.${ownerId}` }, schedule)
      .subscribe(status => {
        if (controller.signal.aborted) return;
        setLive(status === "SUBSCRIBED");
        if (status === "SUBSCRIBED") schedule();
      }) : undefined;
    void refresh();
    window.addEventListener("focus", schedule);
    window.addEventListener("online", schedule);
    document.addEventListener("visibilitychange", schedule);
    // Recover missed events while retaining the visible snapshot.
    const recovery = window.setInterval(schedule, 30000);
    return () => {
      controller.abort(); clearTimeout(debounce); clearInterval(recovery);
      window.removeEventListener("focus", schedule); window.removeEventListener("online", schedule);
      document.removeEventListener("visibilitychange", schedule);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [ownerId, scope, start, end, reload]);

  const received = rows.reduce((total, item) => total + Number(item.received_count), 0);
  const used = rows.reduce((total, item) => total + Number(item.used_count), 0);
  const rate = received ? Math.round(used / received * 100) : 0;
  const items = rows.filter(item => Number(item.received_count) > 0);
  const period = start.slice(0, 7) === end.slice(0, 7) && start.endsWith("-01")
    ? new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "Asia/Bangkok" }).format(new Date(`${start}T12:00:00Z`))
    : "ช่วงที่เลือก";

  return <section className="panel coupon-usage-panel" aria-labelledby="coupon-usage-title">
    <div className="coupon-usage-heading">
      <PawPrint className="coupon-heading-paw" aria-hidden="true" />
      <div><h2 id="coupon-usage-title">สรุปการใช้คูปอง</h2><p><span className={`coupon-live-dot${live ? " is-live" : ""}`} />{live ? "อัปเดตสด" : "อัปเดตอัตโนมัติ"} · {loading ? "กำลังเตรียมยอดสรุป…" : `ใช้แล้ว ${used.toLocaleString("th-TH")} / ${received.toLocaleString("th-TH")} สิทธิ์ (${rate}%)`}</p></div>
      <span className="coupon-period"><CalendarDays size={16} />{period}</span>
      <button className="coupon-usage-toggle" type="button" aria-expanded={expanded} aria-controls="coupon-usage-details" onClick={() => setExpanded(value => !value)}>
        {expanded ? "พับเก็บ" : "ดูรายละเอียด"}<ChevronDown size={18} aria-hidden="true" />
      </button>
    </div>
    {error ? <p className="coupon-usage-state" role="alert">{error}{!loading ? " · แสดงข้อมูลล่าสุดที่ได้รับ" : ""}</p> : null}
    <div id="coupon-usage-details" hidden={!expanded}>
      {loading ? <p className="coupon-usage-state" role="status">กำลังเตรียมข้อมูลครั้งแรก…</p> : <>
        <div className="coupon-usage-hero">
          <div className="coupon-usage-illustration"><Image src="/images/coupon-pets.png" alt="สุนัขและแมวกับบัตรคูปอง" width={340} height={255} /></div>
          <div className="coupon-usage-total"><span>ใช้คูปองแล้ว</span><strong>{used.toLocaleString("th-TH")} <small>สิทธิ์</small></strong></div>
          <div className="coupon-usage-rate"><div><span>อัตราการใช้</span><strong>{rate}%</strong></div><div className="coupon-usage-meter" role="progressbar" aria-label="อัตราการใช้คูปอง" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, rate)}><span style={{ width: `${Math.min(100, rate)}%` }} /></div><p>ใช้แล้ว {used.toLocaleString("th-TH")} จาก {received.toLocaleString("th-TH")} สิทธิ์ที่ลูกค้ารับ</p></div>
        </div>
        <div className="coupon-usage-list"><h3>คูปองแต่ละรายการ</h3>{items.length ? items.map(item => {
          const itemRate = Math.round(Number(item.used_count) / Number(item.received_count) * 100);
          return <div className="coupon-usage-row" key={item.coupon_id}><span className="coupon-row-ticket"><TicketPercent size={18} /></span><strong className="coupon-row-title">{item.title}</strong><span className="coupon-row-count">ใช้แล้ว {Number(item.used_count).toLocaleString("th-TH")} / {Number(item.received_count).toLocaleString("th-TH")} สิทธิ์</span><strong className="coupon-row-rate">{itemRate}%</strong></div>;
        }) : <p className="coupon-usage-empty">ยังไม่มีสิทธิ์คูปองในช่วงเวลานี้</p>}</div>
      </>}
    </div>
  </section>;
}
