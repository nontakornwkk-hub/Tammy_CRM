import "server-only";
import type { MemberSession } from "./member-session";

type DataContext = Pick<MemberSession, "db" | "ownerId" | "memberId" | "catalogDb" | "catalogOwnerId">;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readMemberCatalog(session: DataContext) {
  const { db, ownerId, memberId } = session;
  const catalogDb=session.catalogDb||db,catalogOwnerId=session.catalogOwnerId||ownerId;
  const [rewardResult, couponResult, usedResult, claims, member, settings] = await Promise.all([
    catalogDb.from("rewards").select("id,title,description,category,points_cost,stock,image_url,active,starts_at,ends_at").eq("owner_id", catalogOwnerId).eq("active", true).order("created_at", { ascending: false }),
    catalogDb.from("coupons").select("id,title,description,discount_type,discount_value,min_spend,usage_limit,used_count,active,starts_at,ends_at,theme_color,audience_mode,qr_valid_minutes").eq("owner_id", catalogOwnerId).eq("active", true).order("created_at", { ascending: false }),
    db.from("redemptions").select("coupon_id").eq("owner_id", ownerId).eq("member_id", memberId).eq("status", "completed").not("coupon_id", "is", null),
    db.from("member_coupon_claims").select("coupon_id,campaign_id,status").eq("owner_id", ownerId).eq("member_id", memberId),
    db.from("members").select("spending,level,points").eq("owner_id",ownerId).eq("id",memberId).maybeSingle(),
    catalogDb.from("store_settings").select("extra").eq("owner_id",catalogOwnerId).maybeSingle(),
  ]);
  if (rewardResult.error || couponResult.error || usedResult.error) return json({ error: "โหลดสิทธิพิเศษไม่สำเร็จ" }, 500);
  const now = Date.now();
  const usedCoupons = new Set((usedResult.data || []).map(item => item.coupon_id));
  if (claims.error) return json({ error: "โหลดสิทธิ์คูปองไม่สำเร็จ" }, 500);
  const targetedClaims = (claims.data || []).filter(item => item.status === "available" && item.campaign_id);
  const campaigns = targetedClaims.length ? await db.from("line_coupon_campaigns").select("id,status").in("id", targetedClaims.map(item => item.campaign_id!)) : null;
  if (campaigns?.error) return json({ error: "โหลดสิทธิ์คูปองไม่สำเร็จ" }, 500);
  const sentCampaigns = new Set((campaigns?.data || []).filter(item => item.status === "sent").map(item => item.id));
  const grantedCoupons = new Set(targetedClaims.filter(item => sentCampaigns.has(item.campaign_id!)).map(item => item.coupon_id));
  const withinDates = (item: { starts_at: string | null; ends_at: string | null }) => (!item.starts_at || Date.parse(item.starts_at) <= now) && (!item.ends_at || Date.parse(item.ends_at) >= now);
  const policy=settings.data?.extra as {gold_min_spend?:number;platinum_min_spend?:number}|null;
  const gold=Math.max(1,Number(policy?.gold_min_spend)||5000),platinum=Math.max(gold+1,Number(policy?.platinum_min_spend)||20000);
  const next=member.data?.level==="Platinum"?null:member.data?.level==="Gold"?"Platinum":"Gold";
  const threshold=next==="Platinum"?platinum:gold,spending=Number(member.data?.spending)||0;
  return json({
    points:member.data?.points,
    rankProgress:member.error||settings.error||!member.data?null:{percent:next?Math.min(100,spending/threshold*100):100,remaining:Math.max(0,threshold-spending),next},
    rewards: (rewardResult.data || []).filter(item => withinDates(item) && (item.stock === null || item.stock > 0)),
    coupons: (couponResult.data || []).filter(item => withinDates(item) && !usedCoupons.has(item.id) && (session.catalogDb || item.audience_mode === "public" || grantedCoupons.has(item.id)) && (item.usage_limit === null || item.used_count < item.usage_limit)),
  });
}
