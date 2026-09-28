import { createClient } from "@supabase/supabase-js";
import { e164ToThaiPhone, thaiPhoneToE164 } from "@/lib/line/phone";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && secret ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

export async function POST(request: Request) {
  const db = database();
  if (!db) return json({ error: "ระบบสมาชิกยังตั้งค่าเซิร์ฟเวอร์ไม่ครบ" }, 503);
  let input: { action?: string; phone?: string };
  try {
    const raw = await request.text();
    if (raw.length > 2048) return json({ error: "ข้อมูลมีขนาดใหญ่เกินไป" }, 413);
    input = JSON.parse(raw);
  } catch { return json({ error: "คำขอไม่ถูกต้อง" }, 400); }
  const shop = await db.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").single();
  if (shop.error || !shop.data) return json({ error: "ไม่พบข้อมูลร้าน" }, 503);

  if (input.action === "request") {
    const phone = typeof input.phone === "string" ? input.phone.trim() : "";
    const e164 = thaiPhoneToE164(phone);
    if (!e164) return json({ error: "กรุณากรอกเบอร์โทร 10 หลัก" }, 400);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!publishable) return json({ error: "ยังไม่ได้ตั้งค่าการส่ง OTP" }, 503);
    try {
      const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishable }, cache: "no-store", signal: AbortSignal.timeout(5000) });
      const authSettings = await settings.json() as { external?: { phone?: boolean } };
      if (!settings.ok || authSettings.external?.phone !== true) return json({ error: "ร้านยังไม่เปิด Phone Auth และ SMS provider ใน Supabase" }, 503);
    } catch { return json({ error: "ตรวจระบบ OTP ไม่สำเร็จ กรุณาลองอีกครั้ง" }, 502); }
    const member = await db.from("members").select("id").eq("owner_id", shop.data.owner_id).eq("phone", phone).eq("status", "active").maybeSingle();
    if (member.error) return json({ error: "ตรวจข้อมูลสมาชิกไม่สำเร็จ" }, 500);
    // Do not reveal whether an arbitrary phone number is in the CRM.
    if (!member.data) return json({ sent: true });
    const auth = createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
    const sent = await auth.auth.signInWithOtp({ phone: e164, options: { shouldCreateUser: true } });
    if (sent.error) return json({ error: "ยังส่ง OTP ไม่ได้ กรุณาให้ร้านเปิด Phone Auth และตั้งค่า SMS provider ใน Supabase" }, 503);
    return json({ sent: true });
  }

  if (input.action === "lookup") {
    const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!bearer) return json({ error: "กรุณายืนยัน OTP อีกครั้ง" }, 401);
    const verified = await db.auth.getUser(bearer);
    const phone = verified.data.user?.phone ? e164ToThaiPhone(verified.data.user.phone) : null;
    if (verified.error || !phone || !verified.data.user?.phone_confirmed_at) return json({ error: "ยังไม่ยืนยันเบอร์โทร" }, 401);
    const member = await db.from("members").select("member_code,name,level,points,birth_date").eq("owner_id", shop.data.owner_id).eq("phone", phone).eq("status", "active").maybeSingle();
    if (member.error || !member.data) return json({ error: "ไม่พบสมาชิกที่ใช้เบอร์นี้ กรุณาติดต่อร้าน" }, 404);
    return json({ member: { memberCode: member.data.member_code, name: member.data.name,
      level: member.data.level, points: member.data.points, birthDate: member.data.birth_date } });
  }
  return json({ error: "คำขอไม่ถูกต้อง" }, 400);
}
