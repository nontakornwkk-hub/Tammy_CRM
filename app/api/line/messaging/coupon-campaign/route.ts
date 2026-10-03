import { createHash } from "node:crypto";
import { crmActor, lineConnection, noStore, safeLineUrl, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

type Rank = "Member" | "Silver" | "Gold" | "Platinum";
type Segment = {
  tags: string[];
  tagMode: "any" | "all";
  ranks: Rank[];
  lapsedDays: number | null;
  includeNeverVisited: boolean;
  minSpend: number | null;
};
type Selection = { couponId: string; intro: string; segment: Segment };
type Coupon = { id: string; title: string; description: string; audience_mode: string; active: boolean; starts_at: string | null; ends_at: string | null; usage_limit: number | null; used_count: number };
type Member = { id: string; tags: string[]; level: Rank; spending: number; last_visit: string | null; newsletter_opt_in: boolean; status: string };
type Link = { member_id: string; line_user_id: string };

const ranks = new Set(["Member", "Silver", "Gold", "Platinum"]);
const lineUserId = /^U[0-9a-f]{32}$/i;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseSelection(input: Record<string, unknown>): Selection | null {
  const couponId = typeof input.couponId === "string" ? input.couponId : "";
  const intro = typeof input.intro === "string" ? input.intro.trim() : "";
  const raw = input.segment && typeof input.segment === "object" ? input.segment as Record<string, unknown> : {};
  const tags = Array.isArray(raw.tags) ? [...new Set(raw.tags.filter((tag): tag is string => typeof tag === "string" && tag.length <= 30))] : [];
  const selectedRanks = Array.isArray(raw.ranks) ? [...new Set(raw.ranks.filter((rank): rank is Rank => typeof rank === "string" && ranks.has(rank)))] : [];
  const lapsedDays = raw.lapsedDays === null || raw.lapsedDays === undefined || raw.lapsedDays === "" ? null : Number(raw.lapsedDays);
  const minSpend = raw.minSpend === null || raw.minSpend === undefined || raw.minSpend === "" ? null : Number(raw.minSpend);
  if (!uuid.test(couponId) || intro.length > 300 || tags.length > 10 || selectedRanks.length > 4 ||
      lapsedDays !== null && (!Number.isInteger(lapsedDays) || lapsedDays < 1 || lapsedDays > 365) ||
      minSpend !== null && (!Number.isInteger(minSpend) || minSpend < 0 || minSpend > 100_000_000)) return null;
  return { couponId, intro, segment: { tags, tagMode: raw.tagMode === "all" ? "all" : "any", ranks: selectedRanks,
    lapsedDays, includeNeverVisited: raw.includeNeverVisited === true, minSpend } };
}

function bangkokTodayUtc() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric", month: "numeric", day: "numeric" })
    .formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function matchesSegment(member: Member, segment: Segment, todayUtc: number) {
  if (member.status !== "active") return false;
  if (segment.tags.length && (segment.tagMode === "all"
    ? !segment.tags.every((tag) => member.tags?.includes(tag))
    : !segment.tags.some((tag) => member.tags?.includes(tag)))) return false;
  if (segment.ranks.length && !segment.ranks.includes(member.level)) return false;
  if (segment.minSpend !== null && Number(member.spending) < segment.minSpend) return false;
  if (segment.lapsedDays !== null) {
    if (!member.last_visit) return segment.includeNeverVisited;
    const date = member.last_visit.slice(0, 10).split("-").map(Number);
    if (date.length !== 3 || date.some((value) => !Number.isFinite(value))) return false;
    const days = Math.floor((todayUtc - Date.UTC(date[0], date[1] - 1, date[2])) / 86400000);
    if (days <= segment.lapsedDays) return false;
  }
  return true;
}

async function allRows<T>(db: NonNullable<ReturnType<typeof serviceDb>>, table: string, columns: string, ownerId: string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset <= 10000; offset += 1000) {
    const result = await db.from(table).select(columns).eq("owner_id", ownerId).order("id").range(offset, offset + 999);
    if (result.error) throw result.error;
    rows.push(...(result.data as T[] || []));
    if ((result.data?.length || 0) < 1000) return rows;
  }
  throw new Error("จำนวนสมาชิกมากเกินขอบเขตการส่งครั้งเดียว");
}

async function prepare(db: NonNullable<ReturnType<typeof serviceDb>>, ownerId: string, selection: Selection) {
  const [couponResult, tagResult, members, links, redemptions, claims] = await Promise.all([
    db.from("coupons").select("id,title,description,audience_mode,active,starts_at,ends_at,usage_limit,used_count")
      .eq("owner_id", ownerId).eq("id", selection.couponId).maybeSingle(),
    db.from("member_tag_definitions").select("name").eq("owner_id", ownerId),
    allRows<Member>(db, "members", "id,tags,level,spending,last_visit,newsletter_opt_in,status", ownerId),
    allRows<Link>(db, "members", "id,member_id:id,line_user_id", ownerId),
    db.from("redemptions").select("member_id").eq("owner_id", ownerId).eq("coupon_id", selection.couponId).neq("status", "cancelled"),
    db.from("member_coupon_claims").select("member_id,status").eq("owner_id", ownerId).eq("coupon_id", selection.couponId),
  ]);
  if (couponResult.error || tagResult.error || redemptions.error || claims.error) throw couponResult.error ?? tagResult.error ?? redemptions.error ?? claims.error;
  const coupon = couponResult.data as Coupon | null;
  const now = Date.now();
  if (!coupon?.active || coupon.starts_at && Date.parse(coupon.starts_at) > now || coupon.ends_at && Date.parse(coupon.ends_at) < now)
    throw new Error("คูปองนี้ยังไม่พร้อมใช้งานหรือหมดอายุแล้ว");
  if (coupon.audience_mode !== "targeted") throw new Error("กรุณาเลือกคูปองแบบเฉพาะผู้รับในหน้าคูปอง");
  const availableTags = new Set((tagResult.data || []).map((tag) => tag.name));
  if (selection.segment.tags.some((tag) => !availableTags.has(tag))) throw new Error("แท็กที่เลือกไม่มีอยู่แล้ว กรุณาเลือกใหม่");
  const matched = members.filter((member) => matchesSegment(member, selection.segment, bangkokTodayUtc()));
  const linked = new Map(links.filter((link) => lineUserId.test(link.line_user_id)).map((link) => [link.member_id, link.line_user_id]));
  const used = new Set((redemptions.data || []).map((item) => item.member_id));
  const alreadyGranted = new Set((claims.data || []).map(item => item.member_id));
  const consented = matched.filter((member) => member.newsletter_opt_in);
  const eligible = consented.filter((member) => linked.has(member.id) && !used.has(member.id) && !alreadyGranted.has(member.id));
  const recipients = [...new Set(eligible.map((member) => linked.get(member.id)!))].sort();
  const memberIds = eligible.map(member => member.id);
  const connection = await lineConnection(db, ownerId);
  const membershipUrl = safeLineUrl(connection?.membership_url || process.env.LINE_MEMBERSHIP_URL);
  const message = ["🐾 คูปองพิเศษจาก Tammy Pet Shop", selection.intro,
    `🎟 ${coupon.title}`, coupon.description, "คูปองนี้เป็นสิทธิ์เฉพาะของคุณ แสดง QR ในหน้าสมาชิกที่ร้าน",
    membershipUrl ? `ดูคูปองของคุณ: ${membershipUrl}` : "เปิดหน้าสมาชิกเพื่อดูคูปองของคุณ"].filter(Boolean).join("\n");
  if (message.length > 5000) throw new Error("ข้อความคูปองยาวเกินไป");
  const reserved = (claims.data || []).filter(item => item.status === "available").length;
  const remaining = coupon.usage_limit === null ? null : Math.max(0, coupon.usage_limit - coupon.used_count - reserved);
  const previewHash = createHash("sha256").update(JSON.stringify({ couponId: coupon.id, recipients, message, segment: selection.segment })).digest("hex");
  return { coupon, connection, message, recipients, memberIds, previewHash, remaining,
    counts: { matched: matched.length, consented: consented.length, linked: consented.filter((member) => linked.has(member.id)).length,
      alreadyUsed: consented.filter((member) => used.has(member.id) || alreadyGranted.has(member.id)).length, eligible: recipients.length } };
}

export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้นที่ส่งคูปองได้" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "ยังไม่ได้ตั้งค่าฐานข้อมูลบนเซิร์ฟเวอร์" }, 503);
  const [tags, coupons, campaigns] = await Promise.all([
    db.from("member_tag_definitions").select("name,color").eq("owner_id", actor.ownerId).order("name"),
    db.from("coupons").select("id,title,description,audience_mode,active,starts_at,ends_at,usage_limit,used_count").eq("owner_id", actor.ownerId).eq("active", true).eq("audience_mode", "targeted").order("created_at", { ascending: false }),
    db.from("line_coupon_campaigns").select("id,coupon_title,recipient_count,status,created_at,error_message").eq("owner_id", actor.ownerId).order("created_at", { ascending: false }).limit(5),
  ]);
  if (tags.error || coupons.error || campaigns.error) return noStore({ error: "โหลดข้อมูลส่งคูปองไม่สำเร็จ" }, 500);
  const now = Date.now();
  return noStore({ tags: tags.data || [], coupons: (coupons.data || []).filter((coupon) =>
    (!coupon.starts_at || Date.parse(coupon.starts_at) <= now) && (!coupon.ends_at || Date.parse(coupon.ends_at) >= now) &&
    (coupon.usage_limit === null || coupon.used_count < coupon.usage_limit)), campaigns: campaigns.data || [] });
}

export async function POST(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้นที่ส่งคูปองได้" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "ยังไม่ได้ตั้งค่าฐานข้อมูลบนเซิร์ฟเวอร์" }, 503);
  let input: Record<string, unknown>;
  try { const raw = await request.text(); if (raw.length > 8_192) return noStore({ error: "ข้อมูลยาวเกินไป" }, 413); input = JSON.parse(raw) as Record<string, unknown>; }
  catch { return noStore({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400); }
  if (input.action !== "preview" && input.action !== "send") return noStore({ error: "คำขอไม่ถูกต้อง" }, 400);
  const selection = parseSelection(input);
  if (!selection) return noStore({ error: "กรุณาตรวจคูปองและเงื่อนไขผู้รับอีกครั้ง" }, 400);
  try {
    const prepared = await prepare(db, actor.ownerId, selection);
    if (input.action === "preview") return noStore({ counts: prepared.counts, message: prepared.message,
      couponTitle: prepared.coupon.title, previewHash: prepared.previewHash, remaining: prepared.remaining,
      connected: Boolean(prepared.connection?.access_token || process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN) });
    const requestId = typeof input.requestId === "string" ? input.requestId : "";
    if (!uuid.test(requestId) || input.previewHash !== prepared.previewHash || input.expectedCount !== prepared.recipients.length)
      return noStore({ error: "รายชื่อผู้รับหรือข้อความเปลี่ยนไป กรุณาดูตัวอย่างใหม่ก่อนส่ง" }, 409);
    if (!prepared.recipients.length) return noStore({ error: "ยังไม่มีลูกค้าที่ส่งคูปองได้ตามเงื่อนไขนี้" }, 400);
    if (prepared.recipients.length > 500) return noStore({ error: "ส่งได้สูงสุด 500 คนต่อครั้ง กรุณาเลือกกลุ่มให้แคบลง" }, 400);
    if (prepared.remaining !== null && prepared.remaining < prepared.recipients.length)
      return noStore({ error: "จำนวนคูปองคงเหลือน้อยกว่าจำนวนผู้รับ กรุณาเพิ่มจำนวนคูปองหรือเลือกกลุ่มให้แคบลง" }, 400);
    const token = prepared.connection?.access_token || process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
    if (!token) return noStore({ error: "ยังไม่ได้เชื่อม LINE Messaging API" }, 409);
    const claim = await db.from("line_coupon_campaigns").insert({ id: requestId, owner_id: actor.ownerId,
      actor_id: actor.userId, coupon_id: prepared.coupon.id, coupon_title: prepared.coupon.title,
      segment: selection.segment, message: prepared.message, recipient_count: prepared.recipients.length, status: "sending" });
    if (claim.error) return noStore({ error: claim.error.code === "23505" ? "รายการนี้ถูกส่งไปแล้ว กรุณาตรวจประวัติการส่ง" : "เริ่มส่งคูปองไม่สำเร็จ" }, claim.error.code === "23505" ? 409 : 500);
    const grants = await db.from("member_coupon_claims").insert(prepared.memberIds.map(memberId => ({ owner_id: actor.ownerId, coupon_id: prepared.coupon.id, member_id: memberId, campaign_id: requestId })));
    if (grants.error) {
      await db.from("line_coupon_campaigns").update({ status: "failed", error_message: "ออกสิทธิ์คูปองรายสมาชิกไม่สำเร็จ", finished_at: new Date().toISOString() }).eq("id", requestId);
      return noStore({ error: grants.error.code === "23505" ? "มีสมาชิกในกลุ่มได้รับคูปองนี้แล้ว กรุณาเลือกคูปองใหม่" : "ออกสิทธิ์คูปองรายสมาชิกไม่สำเร็จ" }, 409);
    }
    let response: Response;
    try {
      response = await fetch("https://api.line.me/v2/bot/message/multicast", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "X-Line-Retry-Key": requestId },
        body: JSON.stringify({ to: prepared.recipients, messages: [{ type: "text", text: prepared.message }] }),
        cache: "no-store", signal: AbortSignal.timeout(20_000),
      });
    } catch {
      await db.from("line_coupon_campaigns").update({ status: "failed", error_message: "ไม่ทราบผลการส่งจาก LINE กรุณาตรวจใน LINE ก่อนลองใหม่", finished_at: new Date().toISOString() }).eq("id", requestId);
      return noStore({ error: "ไม่ทราบผลการส่งจาก LINE กรุณาตรวจใน LINE ก่อนลองใหม่เพื่อป้องกันข้อความซ้ำ" }, 502);
    }
    if (!response.ok) {
      const errorText = (await response.text()).slice(0, 500);
      await db.from("member_coupon_claims").delete().eq("owner_id", actor.ownerId).eq("campaign_id", requestId);
      await db.from("line_coupon_campaigns").update({ status: "failed", error_message: `LINE HTTP ${response.status}: ${errorText}`, finished_at: new Date().toISOString() }).eq("id", requestId);
      return noStore({ error: response.status === 429 ? "โควตาหรืออัตราการส่ง LINE เต็ม กรุณาตรวจใน LINE Developers" : "LINE ไม่รับคำขอส่งคูปอง กรุณาตรวจการเชื่อมต่อและโควตา" }, 502);
    }
    const finished = await db.from("line_coupon_campaigns").update({ status: "sent", line_request_id: response.headers.get("x-line-request-id"), finished_at: new Date().toISOString() }).eq("id", requestId);
    if (finished.error) return noStore({ error: "LINE รับข้อความแล้ว แต่บันทึกสถานะสิทธิ์ไม่สำเร็จ กรุณาติดต่อผู้ดูแลก่อนส่งซ้ำ" }, 500);
    return noStore({ sent: prepared.recipients.length, message: "LINE รับคำขอส่งคูปองแล้ว" });
  } catch (error) { return noStore({ error: error instanceof Error ? error.message : "เตรียมคูปองไม่สำเร็จ" }, 500); }
}
