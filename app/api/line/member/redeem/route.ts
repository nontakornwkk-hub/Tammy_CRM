import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ error: "ระบบสมาชิกยังตั้งค่าไม่ครบ" }, 503);
  let input: { idToken?: string; itemId?: string; kind?: string };
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "ข้อมูลมีขนาดใหญ่เกินไป" }, 413);
    input = JSON.parse(raw);
  } catch { return json({ error: "คำขอไม่ถูกต้อง" }, 400); }
  if (!input.idToken || input.idToken.length < 20 || input.idToken.length > 8192) return json({ error: "กรุณาเข้าสู่ระบบ LINE" }, 401);
  if (!input.itemId || !/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(input.itemId) || !["reward", "coupon"].includes(input.kind || "")) return json({ error: "รายการไม่ถูกต้อง" }, 400);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const shop = await db.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").single();
  if (shop.error || !shop.data) return json({ error: "ไม่พบข้อมูลร้าน" }, 503);
  const connection = await db.from("line_connections").select("login_channel_id").eq("owner_id", shop.data.owner_id).maybeSingle();
  const channelId = connection.data?.login_channel_id || process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) return json({ error: "ยังไม่เปิดใช้งาน LINE Login" }, 503);
  let subject: string;
  try {
    const verified = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: input.idToken, client_id: channelId }), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!verified.ok) return json({ error: "กรุณาเข้าสู่ระบบ LINE อีกครั้ง" }, 401);
    const identity = await verified.json() as { aud?: string; sub?: string };
    if (identity.aud !== channelId || !identity.sub || !/^U[0-9a-f]{32}$/.test(identity.sub)) return json({ error: "บัญชี LINE ไม่ถูกต้อง" }, 401);
    subject = identity.sub;
  } catch { return json({ error: "ติดต่อ LINE ไม่สำเร็จ" }, 502); }
  const linked = await db.from("line_member_links").select("member_id").eq("owner_id", shop.data.owner_id).eq("line_user_id", subject).maybeSingle();
  if (linked.error || !linked.data) return json({ error: "กรุณาสมัครสมาชิกก่อน" }, 403);
  const result = await db.rpc("redeem_line_member_item", {
    p_owner_id: shop.data.owner_id, p_member_id: linked.data.member_id, p_item_id: input.itemId, p_kind: input.kind,
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
