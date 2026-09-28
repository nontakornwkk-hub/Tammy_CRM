import { crmActor, noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role === "staff") return noStore({ error: "ไม่มีสิทธิ์ดูข้อมูลสมาชิก LINE" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  const rows: Array<{ member_id: string; line_display_name: string | null; line_picture_url: string | null; profile_synced_at: string | null }> = [];
  for (let offset = 0; offset < 10000; offset += 1000) {
    const result = await db.from("line_member_links").select("member_id,line_display_name,line_picture_url,profile_synced_at")
      .eq("owner_id", actor.ownerId).order("linked_at").range(offset, offset + 999);
    if (result.error) return noStore({ error: "โหลดโปรไฟล์ LINE ไม่สำเร็จ" }, 500);
    rows.push(...(result.data || []));
    if ((result.data || []).length < 1000) break;
  }
  return noStore({ profiles: rows });
}
