import { crmActor, lineConnection, noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await crmActor(request);
  if (!actor) return noStore({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  const db = serviceDb();
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  let input: { conversationId?: string; text?: string; requestId?: string };
  try { input = await request.json() as typeof input; } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  const body = input.text?.trim() || "";
  if (!input.conversationId || !/^[0-9a-f-]{36}$/.test(input.conversationId) ||
      !input.requestId || !/^[0-9a-f-]{36}$/.test(input.requestId) || !body || body.length > 5000)
    return noStore({ error: "กรุณากรอกข้อความไม่เกิน 5,000 ตัวอักษร" }, 400);
  const conversation = await db.from("line_conversations").select("id,line_user_id,assigned_to,blocked_at")
    .eq("owner_id", actor.ownerId).eq("id", input.conversationId).single();
  if (conversation.error || !conversation.data) return noStore({ error: "ไม่พบแชต" }, 404);
  if (actor.role === "staff" && conversation.data.assigned_to !== actor.userId)
    return noStore({ error: "ไม่ได้รับมอบหมายแชตนี้" }, 403);
  if (conversation.data.blocked_at) return noStore({ error: "ลูกค้าบล็อกบัญชีร้าน ไม่สามารถส่งข้อความได้" }, 409);
  const connection = await lineConnection(db, actor.ownerId);
  if (!connection) return noStore({ error: "กรุณาเชื่อม Messaging API ก่อน" }, 503);
  const existing = await db.from("line_messages").select("id,send_status,body,created_at")
    .eq("owner_id", actor.ownerId).eq("client_request_id", input.requestId).maybeSingle();
  if (existing.data && (existing.data.body !== body || Date.now() - new Date(existing.data.created_at).getTime() > 86_400_000))
    return noStore({ error: "รหัสการส่งซ้ำไม่ถูกต้อง" }, 409);
  if (existing.data?.send_status === "sent") return noStore({ ok: true, messageId: existing.data.id });
  if (existing.data?.send_status === "pending") return noStore({ error: "ข้อความนี้กำลังส่งอยู่" }, 409);
  if (!existing.data) {
    const inserted = await db.from("line_messages").insert({ owner_id: actor.ownerId,
      conversation_id: conversation.data.id, client_request_id: input.requestId, direction: "outgoing",
      kind: "text", body, send_status: "pending", sent_by: actor.userId,
    });
    if (inserted.error) return noStore({ error: "บันทึกข้อความก่อนส่งไม่สำเร็จ" }, 500);
  } else {
    await db.from("line_messages").update({ send_status: "pending" }).eq("owner_id", actor.ownerId)
      .eq("client_request_id", input.requestId);
  }
  let accepted = false;
  let retryable = false;
  try {
    const result = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST", headers: { Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": "application/json", "X-Line-Retry-Key": input.requestId },
      body: JSON.stringify({ to: conversation.data.line_user_id, messages: [{ type: "text", text: body }] }),
      signal: AbortSignal.timeout(8000),
    });
    accepted = result.ok || result.status === 409;
    retryable = result.status >= 500 || result.status === 429;
    if (!accepted) console.error("[line-send] LINE rejected push", { status: result.status });
  } catch { retryable = true; }
  await db.from("line_messages").update({ send_status: accepted ? "sent" : "failed" })
    .eq("owner_id", actor.ownerId).eq("client_request_id", input.requestId);
  if (!accepted) return noStore({ error: retryable ? "LINE ยังไม่ยืนยันการส่ง กดลองใหม่ด้วยข้อความเดิม" : "LINE ไม่รับข้อความนี้ ตรวจการเชื่อมต่อหรือโควตา", retryable }, 502);
  await db.from("line_conversations").update({ last_message_at: new Date().toISOString(),
    last_message_preview: body.slice(0, 180), status: "open", updated_at: new Date().toISOString() })
    .eq("owner_id", actor.ownerId).eq("id", input.conversationId);
  return noStore({ ok: true, accepted: true });
}
