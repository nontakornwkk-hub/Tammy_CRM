import { verifiedMemberSession } from "@/lib/line/member-session";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let input: { idToken?: string; otpAccessToken?: string; itemId?: string; kind?: string };
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "ข้อมูลมีขนาดใหญ่เกินไป" }, 413);
    input = JSON.parse(raw);
  } catch { return json({ error: "คำขอไม่ถูกต้อง" }, 400); }
  if (!input.itemId || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(input.itemId) || !["reward", "coupon"].includes(input.kind || "")) return json({ error: "รายการไม่ถูกต้อง" }, 400);
  const session = await verifiedMemberSession(input);
  if ("error" in session) return json({ error: session.error }, session.status);
  const { db, ownerId, memberId } = session;
  const result = await db.rpc("redeem_line_member_item", {
    p_owner_id: ownerId, p_member_id: memberId, p_item_id: input.itemId, p_kind: input.kind,
  });
  if (result.error) {
    const messages: Record<string, string> = {
      NOT_ENOUGH_POINTS: "แต้มไม่เพียงพอ", OUT_OF_STOCK: "ของรางวัลหมดแล้ว", LIMIT_REACHED: "คูปองถูกใช้ครบแล้ว",
      ALREADY_USED: "คุณใช้คูปองนี้แล้ว", ITEM_UNAVAILABLE: "รายการนี้ยังไม่เปิดให้ใช้หรือหมดอายุแล้ว", MEMBER_NOT_FOUND: "ไม่พบสมาชิกที่ใช้งานอยู่",
    };
    return json({ error: messages[result.error.message] || "ทำรายการไม่สำเร็จ กรุณาลองใหม่" }, messages[result.error.message] ? 409 : 500);
  }
  const redemption = Array.isArray(result.data) ? result.data[0] : null;
  return json({ success: true, redemptionId: redemption?.redemption_id, points: redemption?.remaining_points });
}
