"use client";

import { Database, HardDrive, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { crmOwnerId, verifiedCrmUser } from "@/lib/supabase/crm-data";
import { cachedAdminExtras } from "@/lib/supabase/admin-preload";
import { PointsHistoryCleanup } from "./points-history-cleanup";

type Usage = {
  database_bytes: number;
  points_transactions_bytes: number;
  points_transactions_count: number;
  members_count: number;
};
type StorageUsage = { storage_bytes: number; storage_objects: number; unknown_size_objects: number };

// This organization is currently on Supabase Free. Limits are shown separately
// because PostgreSQL and file Storage do not share one quota.
const DATABASE_LIMIT = 500_000_000;
const STORAGE_LIMIT = 1_000_000_000;

function formatBytes(value: number) {
  if (value <= 0) return "0 MB";
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)} KB`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} GB`;
  return `${(value / 1_000_000).toFixed(1)} MB`;
}

function percent(value: number, limit: number) { return Math.min(100, (value / limit) * 100); }

export function DatabaseUsageCard() {
  const preloaded = cachedAdminExtras(verifiedCrmUser() || "", crmOwnerId() || "");
  const [usage, setUsage] = useState<Usage | null>(() => preloaded?.databaseUsage as Usage | null ?? null);
  const [storage, setStorage] = useState<StorageUsage | null>(() => preloaded?.storageUsage as StorageUsage | null ?? null);
  const [loading, setLoading] = useState(() => !preloaded?.databaseUsage || !preloaded?.storageUsage);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!supabase) { setError("ยังไม่ได้ตั้งค่า Supabase"); setLoading(false); return; }
    setLoading(true);
    setError("");
    const [databaseResult, storageResult] = await Promise.all([
      supabase.rpc("crm_database_usage"),
      supabase.rpc("crm_storage_usage"),
    ]);
    if (databaseResult.error) setError("อ่านพื้นที่ฐานข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง");
    else setUsage((Array.isArray(databaseResult.data) ? databaseResult.data[0] : databaseResult.data) as Usage | null);
    if (storageResult.error) setError((current) => `${current ? `${current} ` : ""}อ่านพื้นที่ไฟล์ไม่สำเร็จ กรุณาลองอีกครั้ง`);
    else setStorage((Array.isArray(storageResult.data) ? storageResult.data[0] : storageResult.data) as StorageUsage | null);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  return <section className="settings-card database-usage-card">
    <div className="card-heading">
      <div><h2><HardDrive size={20} /> พื้นที่ใน Supabase</h2><p>ขนาดข้อมูลและไฟล์ของโปรเจกต์นี้ อัปเดตเมื่อกดรีเฟรช</p></div>
      <button className="settings-add compact" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} /> รีเฟรช</button>
    </div>
    {error ? <p className="database-usage-error" role="alert">{error}</p> : null}
    {loading && !usage && !storage ? <p className="database-usage-note">กำลังตรวจพื้นที่…</p> : null}
    {usage && storage ? <div className="database-usage-total"><div><span>ใช้พื้นที่ในโปรเจกต์นี้</span><strong>{formatBytes(usage.database_bytes + storage.storage_bytes)}</strong></div><small>รวมฐานข้อมูลและไฟล์เพื่อดูภาพรวม<br />ทั้งสองส่วนมีโควตาแยกกัน</small></div> : null}
    <div className="database-usage-meters">
      {usage ? <div className="database-usage-meter"><div className="database-usage-meter-heading"><span><Database size={17} /> ฐานข้อมูล</span><strong>{formatBytes(usage.database_bytes)}</strong></div><div className="database-usage-meter-limit">จาก {formatBytes(DATABASE_LIMIT)} <b>{percent(usage.database_bytes, DATABASE_LIMIT).toFixed(1)}%</b></div><progress value={Math.min(usage.database_bytes, DATABASE_LIMIT)} max={DATABASE_LIMIT} aria-label="พื้นที่ฐานข้อมูลที่ใช้" /><small>โควตา Free ต่อโปรเจกต์</small></div> : null}
      {storage ? <div className="database-usage-meter"><div className="database-usage-meter-heading"><span><HardDrive size={17} /> รูปภาพและไฟล์</span><strong>{formatBytes(storage.storage_bytes)}</strong></div><div className="database-usage-meter-limit">จาก {formatBytes(STORAGE_LIMIT)} <b>{percent(storage.storage_bytes, STORAGE_LIMIT).toFixed(1)}%</b></div><progress value={Math.min(storage.storage_bytes, STORAGE_LIMIT)} max={STORAGE_LIMIT} aria-label="พื้นที่ไฟล์ของโปรเจกต์นี้เทียบกับโควตาองค์กร" /><small>{storage.storage_objects.toLocaleString()} ไฟล์ในโปรเจกต์ · โควตา Free ใช้ร่วมกันทั้งองค์กร</small></div> : null}
    </div>
    {usage ? <div className="database-usage-details"><span>ประวัติแต้ม <strong>{formatBytes(usage.points_transactions_bytes)}</strong> ({usage.points_transactions_count.toLocaleString()} รายการ)</span><span>สมาชิก <strong>{usage.members_count.toLocaleString()}</strong> คน</span></div> : null}
    {usage && percent(usage.database_bytes, DATABASE_LIMIT) >= 75 ? <p className="database-usage-warning"><strong>พื้นที่ฐานข้อมูลใกล้เต็ม</strong> ควรดาวน์โหลดและจัดการประวัติเก่าก่อนถึง 500 MB</p> : null}
    <PointsHistoryCleanup onDeleted={() => void refresh()} />
    {storage && storage.unknown_size_objects > 0 ? <p className="database-usage-note">มี {storage.unknown_size_objects.toLocaleString()} ไฟล์ที่ไม่มีข้อมูลขนาด ยอดไฟล์อาจต่ำกว่าความจริง</p> : null}
    <div className="database-usage-footer"><p>ยอดไฟล์คือขนาดปัจจุบันของโปรเจกต์นี้ แต่ Storage คิดโควตาจากค่าเฉลี่ยทั้งองค์กร และฐานข้อมูลมีโควตาแยกต่างหาก <a href="https://supabase.com/dashboard/org/gsjpmpzxpkxbwqfalger/usage" target="_blank" rel="noreferrer">ดูยอดจริงใน Supabase Usage</a></p>{usage && storage ? <p>ประวัติแต้มใช้ {formatBytes(usage.points_transactions_bytes)}; หากต้องลดพื้นที่ ควรตรวจไฟล์ที่ไม่ใช้ก่อนลบประวัติ</p> : null}</div>
    <details className="database-usage-warning"><summary>ข้อควรทราบก่อนลบประวัติแต้ม</summary><p>ไฟล์ CSV อาจมีข้อมูลส่วนบุคคลและยอดซื้อ ควรเก็บไว้ในที่ปลอดภัยและตรวจข้อกำหนดการเก็บเอกสารของร้านก่อนลบ หลังลบแล้วประวัติและรายงานย้อนหลังบางส่วนจะไม่ครบ</p></details>
  </section>;
}
