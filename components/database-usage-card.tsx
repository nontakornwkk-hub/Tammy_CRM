"use client";

import { Database, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Usage = {
  database_bytes: number;
  points_transactions_bytes: number;
  points_transactions_count: number;
  members_count: number;
};

function formatBytes(value: number) {
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

export function DatabaseUsageCard() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase) { setError("ยังไม่ได้ตั้งค่า Supabase"); setLoading(false); return; }
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase.rpc("crm_database_usage");
    if (queryError) setError("อ่านพื้นที่ฐานข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
    else setUsage((Array.isArray(data) ? data[0] : data) as Usage | null);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return <section className="settings-card database-usage-card">
    <div className="card-heading">
      <div><h2><Database size={20} /> พื้นที่ฐานข้อมูล</h2><p>ตรวจการใช้พื้นที่ Supabase Database โดยไม่เปลี่ยนข้อมูลใด ๆ</p></div>
      <button className="settings-add compact" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} /> รีเฟรช</button>
    </div>
    {error ? <p className="database-usage-error" role="alert">{error}</p> : null}
    {loading && !usage ? <p className="database-usage-note">กำลังตรวจพื้นที่…</p> : null}
    {usage ? <div className="database-usage-stats">
      <div><span>ฐานข้อมูลทั้งหมด</span><strong>{formatBytes(usage.database_bytes)}</strong></div>
      <div><span>ประวัติธุรกรรมแต้ม</span><strong>{formatBytes(usage.points_transactions_bytes)}</strong><small>{usage.points_transactions_count.toLocaleString()} รายการ</small></div>
      <div><span>สมาชิก</span><strong>{usage.members_count.toLocaleString()}</strong><small>คน</small></div>
    </div> : null}
    <p className="database-usage-note">ตัวเลขนี้รวมข้อมูลและดัชนีใน PostgreSQL แต่ไม่รวมรูปภาพใน Supabase Storage หรือการใช้งานบริการอื่น หากใช้ Free plan ให้เทียบกับขีดจำกัดฐานข้อมูลใน Dashboard ของ Supabase</p>
    <div className="database-usage-warning"><strong>เรื่องการลบประวัติแต้ม</strong><span>ยอดแต้มและแรงค์ปัจจุบันเก็บในข้อมูลสมาชิก จึงไม่เปลี่ยนเพราะลบประวัติ แต่รายงานย้อนหลังและการตรวจโบนัสอาจเปลี่ยนได้ ระบบจึงยังไม่เปิดปุ่มลบจนกว่าจะมีการสำรองและสรุปรายงานก่อน</span></div>
  </section>;
}
