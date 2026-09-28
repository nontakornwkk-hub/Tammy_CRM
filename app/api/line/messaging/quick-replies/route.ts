import { crmActor, noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor) return noStore({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  const db = serviceDb();
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  const result = await db.from("line_quick_replies").select("id,title,body")
    .eq("owner_id", actor.ownerId).order("created_at").limit(50);
  return result.error ? noStore({ error: "โหลดคำตอบสำเร็จรูปไม่สำเร็จ" }, 500) : noStore({ replies: result.data });
}

export async function POST(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role === "staff") return noStore({ error: "ไม่มีสิทธิ์จัดการคำตอบสำเร็จรูป" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  let input: { title?: string; body?: string };
  try { input = await request.json() as typeof input; } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  const title = input.title?.trim() || "";
  const body = input.body?.trim() || "";
  if (!title || title.length > 80 || !body || body.length > 5000) return noStore({ error: "กรอกชื่อและข้อความให้ครบ" }, 400);
  const result = await db.from("line_quick_replies").insert({ owner_id: actor.ownerId, title, body }).select("id,title,body").single();
  return result.error ? noStore({ error: "บันทึกคำตอบไม่สำเร็จ" }, 500) : noStore({ reply: result.data }, 201);
}

export async function DELETE(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role === "staff") return noStore({ error: "ไม่มีสิทธิ์ลบคำตอบสำเร็จรูป" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return noStore({ error: "ไม่พบคำตอบ" }, 400);
  const result = await db.from("line_quick_replies").delete().eq("owner_id", actor.ownerId).eq("id", id);
  return result.error ? noStore({ error: "ลบคำตอบไม่สำเร็จ" }, 500) : noStore({ ok: true });
}
