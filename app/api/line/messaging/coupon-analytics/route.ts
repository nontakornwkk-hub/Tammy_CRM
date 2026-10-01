import { crmActor, noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role === "staff") return noStore({ error: "ไม่มีสิทธิ์ดูรายงานคูปอง" }, 403);
  const query = new URL(request.url).searchParams;
  const start = query.get("start") || "";
  const end = query.get("end") || "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) ||
      !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end)) ||
      start > end || (Date.parse(end) - Date.parse(start)) / 86400000 > 366) {
    return noStore({ error: "ช่วงวันที่ไม่ถูกต้อง" }, 400);
  }
  const db = serviceDb();
  if (!db) return noStore({ error: "ฐานข้อมูลไม่พร้อมใช้งาน" }, 503);
  const result = await db.rpc("crm_coupon_usage_summary", { p_owner_id: actor.ownerId, p_start: start, p_end: end });
  if (result.error) return noStore({ error: "โหลดข้อมูลการใช้คูปองไม่สำเร็จ" }, 500);
  return noStore({ rows: result.data || [] });
}
