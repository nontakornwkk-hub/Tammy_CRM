import { createClient } from "@supabase/supabase-js";
import { crmActor, noStore } from "@/lib/line/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้น" }, 403);
  return noStore({ configured: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), publishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) });
}

export async function POST(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้น" }, 403);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return noStore({ error: "ยังไม่มี NEXT_PUBLIC_SUPABASE_URL บนเซิร์ฟเวอร์" }, 503);
  let key: string;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return noStore({ error: "คีย์ยาวเกินไป" }, 413);
    const input = JSON.parse(raw) as { secretKey?: unknown };
    key = typeof input.secretKey === "string" ? input.secretKey.trim() : "";
  } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  if (!key || key.length > 4096) return noStore({ error: "กรุณากรอก Secret key" }, 400);
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const result = await db.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (result.error) return noStore({ error: "คีย์นี้ใช้สิทธิ์ระดับเซิร์ฟเวอร์ไม่ได้ ตรวจว่าคัดลอกจาก Secret keys" }, 400);
    return noStore({ valid: true, configured: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY),
      message: "คีย์ถูกต้อง แต่ยังไม่บันทึกบนเซิร์ฟเวอร์ ให้นำไปตั้งเป็น SUPABASE_SECRET_KEY ใน Vercel Environment Variables" });
  } catch { return noStore({ error: "ติดต่อ Supabase ไม่สำเร็จ" }, 502); }
}
