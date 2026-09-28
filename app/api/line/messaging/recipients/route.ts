import { crmActor, noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor) return noStore({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  if (actor.role === "staff") return noStore({ error: "ไม่มีสิทธิ์เริ่มแชตใหม่" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  const links = await db.from("line_member_links").select("member_id,line_display_name,line_picture_url")
    .eq("owner_id", actor.ownerId).order("linked_at", { ascending: false }).limit(200);
  if (links.error) return noStore({ error: "โหลดสมาชิก LINE ไม่สำเร็จ" }, 500);
  const ids = (links.data || []).map(link => link.member_id);
  const members = ids.length ? await db.from("members").select("id,name,member_code,phone")
    .eq("owner_id", actor.ownerId).in("id", ids) : { data: [] };
  return noStore({ recipients: (links.data || []).map(link => ({ ...link,
    member: (members.data || []).find(member => member.id === link.member_id) || null,
  })) });
}
