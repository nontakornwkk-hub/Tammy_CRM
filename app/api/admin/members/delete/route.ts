import { createClient } from "@supabase/supabase-js";
import { crmActor, noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner" || actor.userId !== actor.ownerId)
    return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้นที่ลบสมาชิกได้" }, 403);
  const db = serviceDb();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!db || !url || !publishableKey) return noStore({ error: "ระบบยืนยันตัวตนยังไม่พร้อม" }, 503);

  let input: { memberId?: string; memberCode?: string; password?: string };
  try {
    const raw = await request.text();
    if (raw.length > 4096) return noStore({ error: "ข้อมูลยาวเกินไป" }, 413);
    input = JSON.parse(raw) as typeof input;
  } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  if (!input || typeof input.memberId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.memberId) ||
      typeof input.memberCode !== "string" || !input.memberCode.trim() ||
      typeof input.password !== "string" || !input.password || input.password.length > 256)
    return noStore({ error: "กรุณากรอกรหัสสมาชิกและรหัสผ่าน" }, 400);

  const member = await db.from("members").select("id,member_code")
    .eq("owner_id", actor.ownerId).eq("id", input.memberId).maybeSingle();
  if (member.error) return noStore({ error: "ตรวจข้อมูลสมาชิกไม่สำเร็จ" }, 500);
  if (!member.data) return noStore({ error: "ไม่พบสมาชิก" }, 404);
  if (member.data.member_code !== input.memberCode.trim())
    return noStore({ error: "รหัสสมาชิกไม่ตรงกับคนที่เลือก" }, 400);

  const owner = await db.auth.admin.getUserById(actor.userId);
  if (owner.error || !owner.data.user?.email) return noStore({ error: "ตรวจบัญชีผู้ดูแลไม่สำเร็จ" }, 500);
  const verifier = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const checked = await verifier.auth.signInWithPassword({ email: owner.data.user.email, password: input.password });
  // Password verification creates a separate session; revoke only that session.
  if (checked.data.session) await verifier.auth.signOut({ scope: "local" });
  if (checked.error || checked.data.user?.id !== actor.userId)
    return noStore({ error: "รหัสผ่านผู้ดูแลไม่ถูกต้อง" }, 401);

  const deleted = await db.rpc("delete_crm_member", {
    p_owner_id: actor.ownerId, p_member_id: member.data.id, p_actor_id: actor.userId,
  });
  if (deleted.error) {
    console.error("[member-delete] database operation failed", deleted.error.code);
    return noStore({ error: "ลบสมาชิกไม่สำเร็จ กรุณาลองใหม่" }, 500);
  }
  if (deleted.data !== true) return noStore({ error: "สมาชิกถูกลบไปแล้ว กรุณาโหลดรายการใหม่" }, 409);
  return noStore({ success: true });
}
