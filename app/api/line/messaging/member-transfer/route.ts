import { crmActor, noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

async function context(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role === "staff") return null;
  const db = serviceDb();
  if (!db) return null;
  return { actor, db };
}

export async function GET(request: Request) {
  const session = await context(request);
  if (!session) return noStore({ error: "ไม่มีสิทธิ์จัดการ LINE" }, 403);
  const memberId = new URL(request.url).searchParams.get("memberId");
  if (!/^[0-9a-f-]{36}$/i.test(memberId || "")) return noStore({ error: "สมาชิกไม่ถูกต้อง" }, 400);
  const { actor, db } = session;
  const result = await db.from("line_member_transfer_requests")
    .select("id,status,new_line_display_name,new_line_picture_url,created_at,claimed_at")
    .eq("owner_id", actor.ownerId).eq("member_id", memberId)
    .in("status", ["waiting", "claimed"]).maybeSingle();
  if (result.error) return noStore({ error: "อ่านคำขอไม่สำเร็จ" }, 500);
  return noStore({ transfer: result.data });
}

export async function POST(request: Request) {
  const session = await context(request);
  if (!session) return noStore({ error: "ไม่มีสิทธิ์จัดการ LINE" }, 403);
  let input: { action?: string; memberId?: string; requestId?: string };
  try {
    const raw = await request.text();
    if (raw.length > 1024) return noStore({ error: "ข้อมูลยาวเกินไป" }, 413);
    input = JSON.parse(raw);
  } catch { return noStore({ error: "คำขอไม่ถูกต้อง" }, 400); }
  const { actor, db } = session;
  if (input.action === "start") {
    if (!/^[0-9a-f-]{36}$/i.test(input.memberId || "")) return noStore({ error: "สมาชิกไม่ถูกต้อง" }, 400);
    const member = await db.from("members").select("id,status")
      .eq("owner_id", actor.ownerId).eq("id", input.memberId).maybeSingle();
    if (!member.data || member.data.status !== "active") return noStore({ error: "ไม่พบสมาชิกที่ใช้งานอยู่" }, 404);
    const existing = await db.from("line_member_transfer_requests").select("id")
      .eq("owner_id", actor.ownerId).eq("member_id", input.memberId)
      .in("status", ["waiting", "claimed"]).maybeSingle();
    if (existing.data) return noStore({ error: "สมาชิกนี้มีคำขอเปลี่ยน LINE อยู่แล้ว" }, 409);
    const created = await db.from("line_member_transfer_requests").insert({
      owner_id: actor.ownerId, member_id: input.memberId, created_by: actor.userId,
    }).select("id,status").single();
    if (created.error || !created.data) return noStore({ error: "สร้างคำขอไม่สำเร็จ" }, 500);
    return noStore({ transfer: created.data });
  }
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId || "")) return noStore({ error: "คำขอไม่ถูกต้อง" }, 400);
  const current = await db.from("line_member_transfer_requests").select("id,status,member_id,new_line_display_name")
    .eq("owner_id", actor.ownerId).eq("id", input.requestId).maybeSingle();
  if (!current.data) return noStore({ error: "ไม่พบคำขอ" }, 404);
  if (input.action === "cancel") {
    const result = await db.from("line_member_transfer_requests").update({
      status: "cancelled", cancelled_at: new Date().toISOString(),
    }).eq("owner_id", actor.ownerId).eq("id", input.requestId)
      .in("status", ["waiting", "claimed"]).select("id").maybeSingle();
    if (result.error || !result.data) return noStore({ error: "ยกเลิกไม่สำเร็จ" }, 409);
    return noStore({ success: true });
  }
  if (input.action !== "complete" || current.data.status !== "claimed")
    return noStore({ error: "คำขอยังไม่พร้อมยืนยัน" }, 409);
  const result = await db.rpc("complete_line_member_transfer", {
    p_owner_id: actor.ownerId, p_request_id: input.requestId, p_actor_id: actor.userId,
  });
  if (result.error) {
    const known: Record<string, string> = {
      TRANSFER_NOT_READY: "คำขอนี้ไม่พร้อมใช้งานแล้ว", MEMBER_NOT_ACTIVE: "สมาชิกไม่พร้อมใช้งาน",
      LINE_ALREADY_LINKED: "LINE ใหม่นี้เชื่อมกับสมาชิกอื่นแล้ว",
    };
    return noStore({ error: known[result.error.message] || "เปลี่ยน LINE ไม่สำเร็จ" }, 409);
  }
  return noStore({ success: true });
}
