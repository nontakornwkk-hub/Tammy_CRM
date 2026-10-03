import { crmActor, noStore, serviceDb, safeLineUrl } from "@/lib/line/server";
import { availableActions, compareHistory, historyBounds, parseHistoryCursor, type HistoryEntry } from "@/lib/transaction-history";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const migrationMissing = (code?: string) => ["42P01", "PGRST205", "PGRST202"].includes(code || "");

export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor) return noStore({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  const db = serviceDb();
  if (!db) return noStore({ error: "ฐานข้อมูลไม่พร้อมใช้งาน" }, 503);
  const query = new URL(request.url).searchParams;
  const id = query.get("id");
  const kind = query.get("kind") || "points";
  if (id) {
    if (kind === "redemption" && actor.role === "staff") return noStore({ error: "ไม่มีสิทธิ์ดูรายการแลกสิทธิ์" }, 403);
    if (!uuid.test(id) || !["points", "redemption"].includes(kind)) return noStore({ error: "รายการไม่ถูกต้อง" }, 400);
    const source = await db.from(kind === "points" ? "points_transactions" : "redemptions").select("*").eq("id", id).eq("owner_id", actor.ownerId).maybeSingle();
    if (source.error) return noStore({ error: "อ่านรายการไม่สำเร็จ" }, 500);
    if (!source.data) return noStore({ error: "ไม่พบรายการ" }, 404);
    const row = source.data;
    const [member, journal, metadata, audit, award, bonuses] = await Promise.all([
      db.from("members").select("name,points,line_picture_url,member_code").eq("id", row.member_id).eq("owner_id", actor.ownerId).maybeSingle(),
      db.from("transaction_reversals").select("*").eq("source_kind", kind).eq("source_id", id).eq("owner_id", actor.ownerId).maybeSingle(),
      db.from("transaction_metadata").select("*").eq("source_kind", kind).eq("source_id", id).eq("owner_id", actor.ownerId).maybeSingle(),
      db.from("audit_logs").select("action,details,created_at").eq("owner_id", actor.ownerId).eq("entity_type", kind).eq("entity_id", id).like("action", "transaction_%").order("created_at"),
      kind === "points" ? db.from("audit_logs").select("actor_id,details").eq("owner_id", actor.ownerId).eq("action", "award_points").eq("entity_id", row.member_id).eq("created_at", row.created_at) : Promise.resolve({ data: [] as { actor_id: string | null; details: Record<string, unknown> }[], error: null }),
      kind === "points" && row.transaction_type === "earn" ? db.from("points_transactions").select("points_delta").eq("owner_id", actor.ownerId).eq("member_id", row.member_id).eq("created_at", row.created_at).not("rank_bonus_level", "is", null) : Promise.resolve({ data: [] as { points_delta: number }[], error: null }),
    ]);
    if (member.error || audit.error || award.error || bonuses.error || (journal.error && !migrationMissing(journal.error.code)) || (metadata.error && !migrationMissing(metadata.error.code))) return noStore({ error: "อ่านรายละเอียดรายการไม่สำเร็จ" }, 500);
    const bonusTotal = (bonuses.data || []).reduce((sum, item) => sum + Number(item.points_delta), 0);
    const total = kind === "points" ? Number(row.points_delta) + bonusTotal : Number(row.points_spent);
    const event = award.data?.length === 1 ? award.data[0] : null;
    const actorId = metadata.data?.actor_id || event?.actor_id;
    let actorName = kind === "redemption" ? "สมาชิก / ระบบ (ไม่ได้บันทึกผู้ดำเนินการ)" : "ไม่ได้บันทึกผู้ดำเนินการ";
    if (actorId === actor.ownerId) actorName = "เจ้าของร้าน";
    else if (actorId) {
      const team = await db.from("team_accounts").select("name").eq("owner_id", actor.ownerId).eq("user_id", actorId).maybeSingle();
      if (team.error) return noStore({ error: "อ่านข้อมูลผู้ดำเนินการไม่สำเร็จ" }, 500);
      actorName = team.data?.name || "ผู้ดำเนินการเดิม";
    }
    const originalEvent = audit.data?.find(item => item.action === "transaction_cancel");
    const original = originalEvent?.details?.original;
    const originalBonuses = Array.isArray(original?.rank_bonuses) ? original.rank_bonuses.reduce((sum: number, item: { points_delta: number }) => sum + Number(item.points_delta), 0) : 0;
    const originalTotal = original ? Number(original.points_delta ?? row.points_delta) + originalBonuses : total;
    const originalAfter = typeof event?.details?.points === "number" ? event.details.points : null;
    const pointsAfter = metadata.data?.points_after != null ? Number(metadata.data.points_after) + (kind === "points" && row.transaction_type === "earn" ? bonusTotal || originalBonuses : 0) : originalAfter;
    const pointsBefore = metadata.data?.points_before != null ? Number(metadata.data.points_before) : originalAfter != null ? originalAfter - originalTotal : null;
    let title = row.note || "รายการแต้ม";
    if (kind === "redemption") {
      const catalog = await db.from(row.reward_id ? "rewards" : "coupons").select("title").eq("id", row.reward_id || row.coupon_id).eq("owner_id", actor.ownerId).maybeSingle();
      if (catalog.error) return noStore({ error: "อ่านชื่อสิทธิ์ไม่สำเร็จ" }, 500);
      title = catalog.data?.title || "สิทธิ์เดิม";
    }
    const type = kind === "points" ? row.transaction_type : row.reward_id ? "reward" : "coupon";
    const ready = !journal.error && !metadata.error;
    return noStore({ detail: {
      id, kind, memberId: row.member_id, memberName: member.data?.name || "สมาชิก", memberPicture: safeLineUrl(member.data?.line_picture_url), memberCode: member.data?.member_code || "", createdAt: row.created_at || row.redeemed_at,
      title, type, sale: Number(row.sale_amount || 0), points: kind === "points" ? Number(row.points_delta) : -Number(row.points_spent),
      status: journal.data?.cancelled ? "cancelled" : journal.data?.points_refunded || journal.data?.rights_restored ? "partial" : row.status || "completed", actor: actorName, pointsBefore, pointsAfter,
      currentPoints: Number(member.data?.points || 0),
      note: row.note || "", ready, canManage: actor.role !== "staff",
      actions: ready && actor.role !== "staff" && !(type === "earn" && Number(row.sale_amount) <= 0) ? availableActions(type, Number(row.points_spent || 0), row.status || "completed", journal.data) : [],
      reversalPoints: kind === "points" ? -originalTotal : journal.data?.points_refunded ? 0 : Number(row.points_spent || 0),
      events: (audit.data || []).map(item => ({ action: item.action.replace("transaction_", ""), reason: item.details?.reason || "", createdAt: item.created_at })),
    } });
  }
  const filter = query.get("filter") || "earn";
  if (!["earn", "redemption", "all"].includes(filter) || (filter !== "earn" && actor.role === "staff")) return noStore({ error: "ไม่มีสิทธิ์ดูรายการประเภทนี้" }, 403);
  let cursor;
  try { cursor = parseHistoryCursor(query.get("cursor")); } catch { return noStore({ error: "รายการต่อเนื่องไม่ถูกต้อง" }, 400); }
  let bounds;
  try { bounds = historyBounds(query.get("start") || "", query.get("end") || ""); } catch (cause) { return noStore({ error: (cause as Error).message }, 400); }
  const limit = 20;
  // Fetch only enough rows from each source to merge one page accurately.
  let pointQuery = db.from("points_transactions").select("id,member_id,created_at,note,points_delta,sale_amount,transaction_type").eq("owner_id", actor.ownerId).is("rank_bonus_level", null).neq("transaction_type", "redeem");
  if (filter === "earn") pointQuery = pointQuery.eq("transaction_type", "earn");
  if (bounds) pointQuery = pointQuery.gte("created_at", bounds.from).lt("created_at", bounds.to);
  let redemptionQuery = db.from("redemptions").select("id,member_id,redeemed_at,note,points_spent,status,reward_id,coupon_id").eq("owner_id", actor.ownerId);
  if (bounds) redemptionQuery = redemptionQuery.gte("redeemed_at", bounds.from).lt("redeemed_at", bounds.to);
  if (cursor) {
    const condition = (column: string) => `${column}.lt.${cursor.at},and(${column}.eq.${cursor.at},id.gt.${cursor.id})`;
    if (cursor.kind === "points") {
      pointQuery = pointQuery.or(condition("created_at"));
      redemptionQuery = redemptionQuery.lte("redeemed_at", cursor.at);
    } else {
      pointQuery = pointQuery.lt("created_at", cursor.at);
      redemptionQuery = redemptionQuery.or(condition("redeemed_at"));
    }
  }
  const [points, redemptions] = await Promise.all([
    filter !== "redemption" ? pointQuery.order("created_at", { ascending: false }).order("id").limit(limit + 1) : Promise.resolve({ data: [], error: null }),
    filter !== "earn" ? redemptionQuery.order("redeemed_at", { ascending: false }).order("id").limit(limit + 1) : Promise.resolve({ data: [], error: null }),
  ]);
  if (points.error || redemptions.error) return noStore({ error: "โหลดประวัติไม่สำเร็จ" }, 500);
  const entries: HistoryEntry[] = [
    ...(points.data || []).map(row => ({ id: row.id, kind: "points" as const, memberId: row.member_id, memberName: "", createdAt: row.created_at, title: row.transaction_type === "earn" ? `${Number(row.sale_amount).toLocaleString("th-TH")} บาท` : row.note || "ปรับแต้ม", points: Number(row.points_delta), sale: Number(row.sale_amount), type: row.transaction_type, status: "completed" })),
    ...(redemptions.data || []).map(row => ({ id: row.id, kind: "redemption" as const, memberId: row.member_id, memberName: "", createdAt: row.redeemed_at, title: row.reward_id ? "แลกของรางวัล" : "ใช้คูปอง", points: -Number(row.points_spent), sale: 0, type: row.reward_id ? "reward" : "coupon", status: row.status })),
  ].sort(compareHistory);
  const page = entries.slice(0, limit);
  if (page.length) {
    const members = await db.from("members").select("id,name,line_picture_url,member_code").eq("owner_id", actor.ownerId).in("id", [...new Set(page.map(row => row.memberId))]);
    const states = await db.from("transaction_reversals").select("source_kind,source_id,cancelled,points_refunded,rights_restored").eq("owner_id", actor.ownerId).in("source_id", page.map(row => row.id));
    if (members.error || (states.error && !migrationMissing(states.error.code))) return noStore({ error: "อ่านข้อมูลประวัติไม่สำเร็จ" }, 500);
    for (const row of page) {
      const profile = members.data?.find(member => member.id === row.memberId);
      row.memberName = profile?.name || "สมาชิก";
      row.memberPicture = safeLineUrl(profile?.line_picture_url);
      row.memberCode = profile?.member_code || "";
      const state = states.data?.find(item => item.source_id === row.id && item.source_kind === row.kind);
      if (state?.cancelled) row.status = "cancelled";
      else if (state?.points_refunded || state?.rights_restored) row.status = "partial";
    }
  }
  const last = page.at(-1);
  return noStore({ rows: page, more: entries.length > limit, nextCursor: entries.length > limit && last ? { at: last.createdAt, id: last.id, kind: last.kind } : null });
}

export async function POST(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role === "staff") return noStore({ error: "เฉพาะเจ้าของร้านหรือผู้จัดการที่มีสิทธิ์" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "ฐานข้อมูลไม่พร้อมใช้งาน" }, 503);
  let input;
  try { input = await request.json(); } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  if (!input || typeof input !== "object" || !uuid.test(input.id || "") || !["points", "redemption"].includes(input.kind) || !["cancel", "refund_points", "restore_rights"].includes(input.action) || typeof input.reason !== "string" || input.reason.trim().length < 3 || input.reason.trim().length > 500) return noStore({ error: "กรุณาระบุรายการและเหตุผล 3–500 ตัวอักษร" }, 400);
  const result = await db.rpc("reverse_crm_transaction", { p_owner_id: actor.ownerId, p_actor_id: actor.userId, p_kind: input.kind, p_id: input.id, p_action: input.action, p_reason: input.reason.trim() });
  if (result.error) {
    const errors: Record<string, string> = { FORBIDDEN: "ไม่มีสิทธิ์จัดการรายการ", NOT_FOUND: "ไม่พบรายการ", ALREADY_REVERSED: "รายการนี้คืนหรือยกเลิกแล้ว", ACTION_UNAVAILABLE: "ไม่สามารถใช้คำสั่งนี้กับสถานะปัจจุบัน", INSUFFICIENT_BALANCE: "แต้มคงเหลือหรือยอดซื้อสะสมไม่เพียงพอสำหรับยกเลิกรายการ", AMBIGUOUS_TRANSACTION: "รายการนี้มีข้อมูลต้นทางซ้ำ ต้องตรวจสอบก่อนยกเลิก", INVALID_REQUEST: "ข้อมูลไม่ถูกต้อง" };
    if (migrationMissing(result.error.code)) return noStore({ error: "ระบบคืนรายการยังรอเปิดใช้ฐานข้อมูล" }, 503);
    return noStore({ error: errors[result.error.message] || "ทำรายการไม่สำเร็จ กรุณาตรวจสถานะและลองอีกครั้ง" }, 409);
  }
  return noStore({ success: true, result: result.data });
}
