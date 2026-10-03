import { crmActor, noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

const columns = "id,owner_id,member_id,sale_amount,points_delta,transaction_type,note,created_at,birthday_bonus_year,rank_bonus_level";
type HistoryRow = { id: string; owner_id: string; member_id: string; sale_amount: number; points_delta: number; transaction_type: string; note: string; created_at: string; birthday_bonus_year: number | null; rank_bonus_level: string | null };

function yearBounds(year: number) {
  const currentYear = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()));
  if (!Number.isInteger(year) || year < 2020 || year >= currentYear) return null;
  return {
    from: new Date(Date.UTC(year - 1, 11, 31, 17)).toISOString(),
    to: new Date(Date.UTC(year, 11, 31, 17)).toISOString(),
  };
}

function csvCell(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

async function authorized(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return null;
  const db = serviceDb();
  return db ? { actor, db } : null;
}

export async function GET(request: Request) {
  const access = await authorized(request);
  if (!access) return noStore({ error: "เฉพาะเจ้าของร้านที่เข้าสู่ระบบเท่านั้น" }, 403);
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  const bounds = yearBounds(year);
  if (!bounds) return noStore({ error: "เลือกปีที่ผ่านไปแล้ว" }, 400);
  const { actor, db } = access;
  const filter = () => db.from("points_transactions").select("id", { count: "exact", head: true })
    .eq("owner_id", actor.ownerId).gte("created_at", bounds.from).lt("created_at", bounds.to).is("rank_bonus_level", null);
  if (url.searchParams.get("download") !== "1") {
    const result = await filter();
    return result.error ? noStore({ error: "นับรายการไม่สำเร็จ" }, 500) : noStore({ year, count: result.count || 0 });
  }

  let exportedCount = 0;
  let lastId: string | null = null;
  let started = false;
  const encoder = new TextEncoder();
  async function complete(controller: ReadableStreamDefaultController<Uint8Array>) {
    const recorded = await db.from("audit_logs").insert({ owner_id: actor.ownerId, actor_id: actor.userId,
      action: "export_points_history", entity_type: "points_transactions", entity_id: String(year),
      details: { year, count: exportedCount } });
    if (recorded.error) { controller.error(new Error("บันทึกหลักฐานการสำรองไม่สำเร็จ")); return; }
    controller.close();
  }
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!started) {
        controller.enqueue(encoder.encode("\uFEFFid,owner_id,member_id,sale_amount,points_delta,transaction_type,note,created_at,birthday_bonus_year,rank_bonus_level\r\n"));
        started = true;
      }
      let query = db.from("points_transactions").select(columns)
        .eq("owner_id", actor.ownerId).gte("created_at", bounds.from).lt("created_at", bounds.to)
        .is("rank_bonus_level", null).order("id").limit(500);
      if (lastId) query = query.gt("id", lastId);
      const result = await query;
      if (result.error) { controller.error(new Error("ส่งออกประวัติไม่สำเร็จ")); return; }
      const rows = (result.data || []) as unknown as HistoryRow[];
      if (rows.length === 0) { await complete(controller); return; }
      controller.enqueue(encoder.encode(rows.map(row => [row.id, row.owner_id, row.member_id, row.sale_amount,
        row.points_delta, row.transaction_type, row.note, row.created_at, row.birthday_bonus_year,
        row.rank_bonus_level].map(csvCell).join(",")).join("\r\n") + "\r\n"));
      exportedCount += rows.length;
      lastId = rows[rows.length - 1].id;
      if (rows.length < 500) await complete(controller);
    },
  });
  return new Response(stream, { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="tammy-points-history-${year}.csv"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}

export async function POST(request: Request) {
  const access = await authorized(request);
  if (!access) return noStore({ error: "เฉพาะเจ้าของร้านที่เข้าสู่ระบบเท่านั้น" }, 403);
  let input: { year?: number; expectedCount?: number; confirmation?: string };
  try { input = await request.json() as typeof input; } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  const year = Number(input.year);
  const bounds = yearBounds(year);
  if (!bounds || input.confirmation !== `ลบ ${year}` || !Number.isInteger(input.expectedCount) || (input.expectedCount || 0) < 1)
    return noStore({ error: "กรุณาตรวจปี จำนวนรายการ และคำยืนยัน" }, 400);
  const { actor, db } = access;
  const base = () => db.from("points_transactions").select("id", { count: "exact", head: true })
    .eq("owner_id", actor.ownerId).gte("created_at", bounds.from).lt("created_at", bounds.to).is("rank_bonus_level", null);
  const before = await base();
  if (before.error) return noStore({ error: "นับรายการไม่สำเร็จ" }, 500);
  if (before.count !== input.expectedCount) return noStore({ error: "จำนวนรายการเปลี่ยนไป กรุณาตรวจใหม่ก่อนลบ" }, 409);
  const archived = await db.from("audit_logs").select("created_at,details")
    .eq("owner_id", actor.ownerId).eq("actor_id", actor.userId).eq("action", "export_points_history")
    .eq("entity_id", String(year)).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const archiveCount = Number((archived.data?.details as { count?: number } | null)?.count);
  if (archived.error || !archived.data || archiveCount < (before.count || 0) ||
      Date.now() - new Date(archived.data.created_at).getTime() > 2 * 60 * 60 * 1000)
    return noStore({ error: "กรุณาดาวน์โหลด CSV ของปีนี้ใหม่ก่อนลบ" }, 409);
  let deletedCount = 0;
  for (let batch = 0; batch < 10; batch++) {
    const candidates = await db.from("points_transactions").select("id")
      .eq("owner_id", actor.ownerId).gte("created_at", bounds.from).lt("created_at", bounds.to)
      .is("rank_bonus_level", null).order("created_at").order("id").limit(200);
    if (candidates.error) return noStore({ error: "อ่านรายการที่จะลบไม่สำเร็จ", deleted: deletedCount }, 500);
    const ids = (candidates.data || []).map(row => row.id);
    if (ids.length === 0) break;
    const deleted = await db.from("points_transactions").delete().eq("owner_id", actor.ownerId).in("id", ids).select("id");
    if (deleted.error) return noStore({ error: "ลบประวัติไม่สำเร็จ", deleted: deletedCount }, 500);
    deletedCount += deleted.data?.length || 0;
    if (ids.length < 200) break;
  }
  if (deletedCount > 0) {
    const audit = await db.from("audit_logs").insert({ owner_id: actor.ownerId, actor_id: actor.userId,
      action: "delete_archived_points_history", entity_type: "points_transactions", entity_id: String(year),
      details: { year, deleted: deletedCount, remaining: Math.max(0, (before.count || 0) - deletedCount) } });
    if (audit.error) console.error("[points-history] audit insert failed", audit.error.message);
  }
  return noStore({ deleted: deletedCount, remaining: Math.max(0, (before.count || 0) - deletedCount) });
}
