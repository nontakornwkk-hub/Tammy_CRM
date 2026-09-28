import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ error: "ระบบสมาชิกยังตั้งค่าไม่ครบ" }, 503);
  let idToken: string;
  let memberId: string;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "ข้อมูลมีขนาดใหญ่เกินไป" }, 413);
    idToken = (JSON.parse(raw) as { idToken?: string }).idToken || "";
  } catch { return json({ error: "คำขอไม่ถูกต้อง" }, 400); }
  if (idToken.length < 20 || idToken.length > 8192) return json({ error: "กรุณาเข้าสู่ระบบ LINE" }, 401);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const shop = await db.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").single();
  if (shop.error || !shop.data) return json({ error: "ไม่พบข้อมูลร้าน" }, 503);
  const connection = await db.from("line_connections").select("login_channel_id").eq("owner_id", shop.data.owner_id).maybeSingle();
  const channelId = connection.data?.login_channel_id || process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) return json({ error: "ยังไม่เปิดใช้งาน LINE Login" }, 503);
  try {
    const verified = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!verified.ok) return json({ error: "กรุณาเข้าสู่ระบบ LINE อีกครั้ง" }, 401);
    const identity = await verified.json() as { aud?: string; sub?: string };
    if (identity.aud !== channelId || !identity.sub || !/^U[0-9a-f]{32}$/.test(identity.sub)) return json({ error: "บัญชี LINE ไม่ถูกต้อง" }, 401);
    const linked = await db.from("line_member_links").select("member_id").eq("owner_id", shop.data.owner_id).eq("line_user_id", identity.sub).maybeSingle();
    if (linked.error || !linked.data) return json({ error: "กรุณาสมัครสมาชิกก่อน" }, 403);
    memberId = linked.data.member_id;
  } catch { return json({ error: "ติดต่อ LINE ไม่สำเร็จ" }, 502); }
  const [rewardResult, couponResult, usedResult] = await Promise.all([
    db.from("rewards").select("id,title,description,category,points_cost,stock,image_url,active,starts_at,ends_at").eq("owner_id", shop.data.owner_id).eq("active", true).order("created_at", { ascending: false }),
    db.from("coupons").select("id,title,description,code,discount_type,discount_value,min_spend,usage_limit,used_count,active,starts_at,ends_at,theme_color").eq("owner_id", shop.data.owner_id).eq("active", true).order("created_at", { ascending: false }),
    db.from("redemptions").select("coupon_id").eq("owner_id", shop.data.owner_id).eq("member_id", memberId).neq("status", "cancelled").not("coupon_id", "is", null),
  ]);
  if (rewardResult.error || couponResult.error || usedResult.error) return json({ error: "โหลดสิทธิพิเศษไม่สำเร็จ" }, 500);
  const now = Date.now();
  const usedCoupons = new Set((usedResult.data || []).map(item => item.coupon_id));
  const withinDates = (item: { starts_at: string | null; ends_at: string | null }) => (!item.starts_at || Date.parse(item.starts_at) <= now) && (!item.ends_at || Date.parse(item.ends_at) >= now);
  return json({
    rewards: (rewardResult.data || []).filter(item => withinDates(item) && (item.stock === null || item.stock > 0)),
    coupons: (couponResult.data || []).filter(item => withinDates(item) && !usedCoupons.has(item.id) && (item.usage_limit === null || item.used_count < item.usage_limit)),
  });
}
