import { crmActor, noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

async function context(request: Request) {
  const actor = await crmActor(request);
  const db = serviceDb();
  return { actor, db };
}

export async function GET(request: Request) {
  const { actor, db } = await context(request);
  if (!actor) return noStore({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  let query = db.from("line_conversations").select("id,line_user_id,member_id,display_name,picture_url,status,assigned_to,internal_note,unread_count,last_message_at,last_message_preview,blocked_at")
    .eq("owner_id", actor.ownerId).order("last_message_at", { ascending: false, nullsFirst: false }).limit(100);
  if (actor.role === "staff") query = query.eq("assigned_to", actor.userId);
  const conversations = await query;
  if (conversations.error) return noStore({ error: "โหลดแชตไม่สำเร็จ" }, 500);
  const rows = conversations.data || [];
  const memberIds = [...new Set(rows.map(row => row.member_id).filter((id): id is string => Boolean(id)))];
  const members = memberIds.length ? await db.from("members").select("id,name,member_code,phone,points,level")
    .eq("owner_id", actor.ownerId).in("id", memberIds) : { data: [] };
  const team = actor.role !== "staff" ? await db.from("team_accounts").select("user_id,name,role")
    .eq("owner_id", actor.ownerId).eq("active", true).not("user_id", "is", null) : { data: [] };
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  let messages: unknown[] = [];
  if (conversationId) {
    if (!rows.some(row => row.id === conversationId)) return noStore({ error: "ไม่มีสิทธิ์เปิดแชตนี้" }, 403);
    const result = await db.from("line_messages").select("id,direction,kind,body,send_status,sent_by,created_at,client_request_id")
      .eq("owner_id", actor.ownerId).eq("conversation_id", conversationId)
      .order("created_at", { ascending: false }).limit(100);
    if (result.error) return noStore({ error: "โหลดข้อความไม่สำเร็จ" }, 500);
    messages = (result.data || []).reverse();
  }
  return noStore({ conversations: rows, messages, members: members.data || [], team: team.data || [] });
}

export async function POST(request: Request) {
  const { actor, db } = await context(request);
  if (!actor) return noStore({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  if (actor.role === "staff") return noStore({ error: "ให้ผู้จัดการเริ่มแชตใหม่และมอบหมายให้ก่อน" }, 403);
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  let input: { memberId?: string };
  try { input = await request.json() as { memberId?: string }; } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  if (!input.memberId || !/^[0-9a-f-]{36}$/.test(input.memberId)) return noStore({ error: "กรุณาเลือกสมาชิก" }, 400);
  const link = await db.from("line_member_links").select("line_user_id,line_display_name,line_picture_url")
    .eq("owner_id", actor.ownerId).eq("member_id", input.memberId).maybeSingle();
  if (link.error || !link.data) return noStore({ error: "สมาชิกคนนี้ยังไม่ได้ผูก LINE" }, 404);
  const member = await db.from("members").select("name").eq("owner_id", actor.ownerId).eq("id", input.memberId).single();
  const created = await db.from("line_conversations").upsert({ owner_id: actor.ownerId,
    line_user_id: link.data.line_user_id, member_id: input.memberId,
    display_name: link.data.line_display_name || member.data?.name || "ลูกค้า LINE",
    picture_url: link.data.line_picture_url || null,
  }, { onConflict: "owner_id,line_user_id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (created.error) return noStore({ error: "เปิดแชตไม่สำเร็จ" }, 500);
  if (created.data) return noStore({ conversationId: created.data.id }, 201);
  const existing = await db.from("line_conversations").select("id")
    .eq("owner_id", actor.ownerId).eq("line_user_id", link.data.line_user_id).single();
  return existing.data ? noStore({ conversationId: existing.data.id }) : noStore({ error: "เปิดแชตไม่สำเร็จ" }, 500);
}

export async function PATCH(request: Request) {
  const { actor, db } = await context(request);
  if (!actor) return noStore({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  let input: { conversationId?: string; status?: string; assignedTo?: string | null; internalNote?: string; read?: boolean };
  try { input = await request.json() as typeof input; } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  if (!input.conversationId || !/^[0-9a-f-]{36}$/.test(input.conversationId)) return noStore({ error: "ไม่พบแชต" }, 400);
  const existing = await db.from("line_conversations").select("assigned_to").eq("owner_id", actor.ownerId).eq("id", input.conversationId).single();
  if (existing.error || !existing.data) return noStore({ error: "ไม่พบแชต" }, 404);
  if (actor.role === "staff" && existing.data.assigned_to !== actor.userId) return noStore({ error: "ไม่ได้รับมอบหมายแชตนี้" }, 403);
  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.read === true) changes.unread_count = 0;
  if (input.status !== undefined) {
    if (!["new", "open", "closed"].includes(input.status)) return noStore({ error: "สถานะไม่ถูกต้อง" }, 400);
    changes.status = input.status;
  }
  if (input.internalNote !== undefined) {
    if (typeof input.internalNote !== "string" || input.internalNote.length > 3000) return noStore({ error: "โน้ตยาวเกินไป" }, 400);
    changes.internal_note = input.internalNote;
  }
  if (input.assignedTo !== undefined) {
    if (actor.role === "staff") return noStore({ error: "ไม่มีสิทธิ์มอบหมายแชต" }, 403);
    if (input.assignedTo !== null) {
      const team = await db.from("team_accounts").select("id").eq("owner_id", actor.ownerId)
        .eq("user_id", input.assignedTo).eq("active", true).maybeSingle();
      if (team.error || !team.data) return noStore({ error: "ไม่พบพนักงานที่เลือก" }, 400);
    }
    changes.assigned_to = input.assignedTo;
  }
  const saved = await db.from("line_conversations").update(changes).eq("owner_id", actor.ownerId).eq("id", input.conversationId);
  return saved.error ? noStore({ error: "บันทึกแชตไม่สำเร็จ" }, 500) : noStore({ ok: true });
}
