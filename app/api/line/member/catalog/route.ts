import { verifiedMemberSession } from "@/lib/line/member-session";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let input: { idToken?: string };
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "ข้อมูลมีขนาดใหญ่เกินไป" }, 413);
    input = JSON.parse(raw);
  } catch { return json({ error: "คำขอไม่ถูกต้อง" }, 400); }
  const session = await verifiedMemberSession(input);
  if ("error" in session) return json({ error: session.error }, session.status);
  const { db, ownerId, memberId } = session;
  const [rewardResult, couponResult, usedResult] = await Promise.all([
    db.from("rewards").select("id,title,description,category,points_cost,stock,image_url,active,starts_at,ends_at").eq("owner_id", ownerId).eq("active", true).order("created_at", { ascending: false }),
    db.from("coupons").select("id,title,description,code,discount_type,discount_value,min_spend,usage_limit,used_count,active,starts_at,ends_at,theme_color").eq("owner_id", ownerId).eq("active", true).order("created_at", { ascending: false }),
    db.from("redemptions").select("coupon_id").eq("owner_id", ownerId).eq("member_id", memberId).neq("status", "cancelled").not("coupon_id", "is", null),
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
