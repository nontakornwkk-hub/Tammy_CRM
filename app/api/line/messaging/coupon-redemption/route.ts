import { crmActor, noStore, serviceDb } from "@/lib/line/server";
import { testServiceDb } from "@/lib/line/test-member-session";

export const runtime = "nodejs";
const qrPattern = /^(?:TAMMY-(TEST-)?COUPON:)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export async function POST(request: Request) {
  const actor = await crmActor(request);
  if (!actor) return noStore({ error: "กรุณาเข้าสู่ระบบพนักงาน" }, 401);
  let input: { action?: string; qr?: string };
  try { const raw = await request.text(); if (raw.length > 1024) return noStore({ error: "ข้อมูลยาวเกินไป" }, 413); input = JSON.parse(raw); }
  catch { return noStore({ error: "คำขอไม่ถูกต้อง" }, 400); }
  const match = qrPattern.exec(input.qr?.trim() || "");
  const token = match?.[2];
  if (!token || !["inspect", "redeem"].includes(input.action || "")) return noStore({ error: "QR คูปองไม่ถูกต้อง" }, 400);
  const isTest = Boolean(match?.[1]);
  const db = isTest ? testServiceDb() : serviceDb();
  if (!db) return noStore({ error: "ยังไม่ได้ตั้งค่าฐานข้อมูล" }, 503);
  const ownerId = isTest ? (await db.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").maybeSingle()).data?.owner_id : actor.ownerId;
  if (!ownerId) return noStore({ error: "ไม่พบร้านทดสอบ" }, 503);
  const claim = await db.from("member_coupon_claims").select("id,member_id,coupon_id,status,qr_expires_at").eq("owner_id", ownerId).eq("qr_token", token).maybeSingle();
  if (claim.error || !claim.data) return noStore({ error: "ไม่พบคูปองของร้านนี้" }, 404);
  if (!claim.data.qr_expires_at || Date.parse(claim.data.qr_expires_at) <= Date.now()) return noStore({ error: "QR คูปองหมดเวลาแล้ว ให้ลูกค้าเปิด QR ใหม่" }, 410);
  const [member, coupon] = await Promise.all([
    db.from("members").select("id,name,member_code,status").eq("owner_id", ownerId).eq("id", claim.data.member_id).maybeSingle(),
    db.from("coupons").select("id,title,discount_type,discount_value,min_spend,active,starts_at,ends_at").eq("owner_id", ownerId).eq("id", claim.data.coupon_id).maybeSingle(),
  ]);
  if (!member.data || !coupon.data) return noStore({ error: "ข้อมูลคูปองไม่ครบ" }, 404);
  if (input.action === "inspect") return noStore({ claim: { status: claim.data.status, member: member.data, coupon: coupon.data } });
  const result = await db.rpc("redeem_member_coupon_qr", { p_owner_id: ownerId, p_token: token });
  if (result.error) {
    const errors: Record<string, string> = { ALREADY_USED: "คูปองนี้ใช้ไปแล้ว", QR_EXPIRED: "QR คูปองหมดเวลาแล้ว ให้ลูกค้าเปิด QR ใหม่", ITEM_UNAVAILABLE: "คูปองหมดอายุหรือปิดใช้งาน", LIMIT_REACHED: "คูปองถูกใช้ครบแล้ว", MEMBER_NOT_FOUND: "สมาชิกไม่พร้อมใช้งาน" };
    return noStore({ error: errors[result.error.message] || "ใช้สิทธิ์ไม่สำเร็จ" }, errors[result.error.message] ? 409 : 500);
  }
  return noStore({ success: true, member: member.data, coupon: coupon.data });
}
