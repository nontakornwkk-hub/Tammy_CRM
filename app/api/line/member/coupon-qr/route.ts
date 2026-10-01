import { verifiedMemberSession } from "@/lib/line/member-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let input: { idToken?: string; accessToken?: string; couponId?: string; action?: string };
  try { const raw = await request.text(); if (raw.length > 8192) return Response.json({ error: "ข้อมูลยาวเกินไป" }, { status: 413 }); input = JSON.parse(raw); }
  catch { return Response.json({ error: "คำขอไม่ถูกต้อง" }, { status: 400 }); }
  if (!input.couponId || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(input.couponId)) return Response.json({ error: "คูปองไม่ถูกต้อง" }, { status: 400 });
  const session = await verifiedMemberSession(input);
  if ("error" in session) return Response.json({ error: session.error }, { status: session.status });
  if (input.action === "status") {
    const claim = await session.db.from("member_coupon_claims").select("status")
      .eq("owner_id", session.ownerId).eq("member_id", session.memberId).eq("coupon_id", input.couponId).maybeSingle();
    if (claim.error) return Response.json({ error: "ตรวจสถานะคูปองไม่สำเร็จ" }, { status: 500 });
    return Response.json({ used: claim.data?.status === "used" }, { headers: { "Cache-Control": "no-store" } });
  }
  const result = await session.db.rpc("issue_member_coupon_qr_once", { p_owner_id: session.ownerId, p_member_id: session.memberId, p_coupon_id: input.couponId });
  if (result.error) {
    const errors: Record<string, string> = { NOT_ELIGIBLE: "คูปองนี้เป็นสิทธิ์เฉพาะผู้รับ", ALREADY_USED: "คุณใช้คูปองนี้แล้ว", QR_EXPIRED: "QR คูปองหมดเวลาแล้ว ไม่สามารถเปิดใหม่ได้", ITEM_UNAVAILABLE: "คูปองยังไม่เปิดให้ใช้หรือหมดอายุแล้ว", LIMIT_REACHED: "คูปองถูกใช้ครบแล้ว" };
    return Response.json({ error: errors[result.error.message] || "เปิด QR ไม่สำเร็จ" }, { status: errors[result.error.message] ? 409 : 500 });
  }
  const claim = (result.data as { qr_token: string; qr_expires_at: string }[] | null)?.[0];
  if (!claim?.qr_token || !claim.qr_expires_at) return Response.json({ error: "ไม่พบสิทธิ์คูปอง" }, { status: 500 });
  return Response.json({ qrPayload: `${input.accessToken?.startsWith("test:") ? "TAMMY-TEST-COUPON" : "TAMMY-COUPON"}:${claim.qr_token}`, expiresAt: claim.qr_expires_at }, { headers: { "Cache-Control": "no-store" } });
}
