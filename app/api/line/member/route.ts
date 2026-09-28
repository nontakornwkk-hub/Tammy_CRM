import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type Registration = {
  firstName: string;
  lastName: string;
  gender: "male" | "female" | "other" | "prefer_not_to_say";
  birthDate: string;
  phone: string;
  termsAccepted: true;
};

const genders = new Set<Registration["gender"]>(["male", "female", "other", "prefer_not_to_say"]);

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function validRegistration(value: unknown): value is Registration {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  if (typeof item.firstName !== "string" || !item.firstName.trim() || item.firstName.trim().length > 80) return false;
  if (typeof item.lastName !== "string" || !item.lastName.trim() || item.lastName.trim().length > 80) return false;
  if (item.termsAccepted !== true) return false;
  if (!genders.has(item.gender as Registration["gender"])) return false;
  if (typeof item.phone !== "string" || !/^0\d{9}$/.test(item.phone)) return false;
  if (typeof item.birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(item.birthDate)) return false;
  const date = new Date(`${item.birthDate}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === item.birthDate
    && item.birthDate >= "1900-01-01" && item.birthDate <= new Date().toISOString().slice(0, 10);
}

function publicMember(member: Record<string, unknown>) {
  return {
    memberCode: member.member_code,
    name: member.name,
    level: member.level,
    points: member.points,
    birthDate: member.birth_date,
  };
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) return json({ error: "ระบบสมัครผ่าน LINE ยังตั้งค่าไม่ครบ" }, 503);
  const db = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const shop = await db.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").single();
  if (shop.error || !shop.data) return json({ error: "ยังไม่พบข้อมูลร้าน" }, 503);
  const configured = await db.from("line_connections").select("login_channel_id")
    .eq("owner_id", shop.data.owner_id).maybeSingle();
  if (configured.error) return json({ error: "ตรวจการเชื่อมต่อ LINE ไม่สำเร็จ" }, 503);
  const channelId = configured.data?.login_channel_id || process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) return json({ error: "ยังไม่ได้ตั้งค่า LINE Login Channel ID" }, 503);

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "ข้อมูลที่ส่งมีขนาดใหญ่เกินไป" }, 413);
    input = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
  }
  if (typeof input.idToken !== "string" || input.idToken.length < 20 || input.idToken.length > 8192)
    return json({ error: "กรุณาเข้าสู่ระบบผ่าน LINE อีกครั้ง" }, 401);
  if (input.action !== "lookup" && input.action !== "register") return json({ error: "คำขอไม่ถูกต้อง" }, 400);
  if (input.action === "register" && !validRegistration(input.registration))
    return json({ error: "กรุณากรอกข้อมูลให้ครบและตรวจสอบเบอร์โทรกับวันเกิด" }, 400);

  let lineSubject: string;
  let lineDisplayName: string | null = null;
  let linePictureUrl: string | null = null;
  try {
    const verified = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: input.idToken, client_id: channelId }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!verified.ok) return json({ error: "ยืนยันบัญชี LINE ไม่สำเร็จ กรุณาเปิดหน้าใหม่" }, 401);
    const identity = await verified.json() as { sub?: string; aud?: string; name?: string; picture?: string };
    if (identity.aud !== channelId || !identity.sub || !/^U[0-9a-f]{32}$/.test(identity.sub))
      return json({ error: "ข้อมูลบัญชี LINE ไม่ถูกต้อง" }, 401);
    lineSubject = identity.sub;
    lineDisplayName = identity.name?.slice(0, 120) || null;
    linePictureUrl = identity.picture?.startsWith("https://") ? identity.picture : null;
  } catch {
    return json({ error: "ติดต่อ LINE ไม่สำเร็จ กรุณาลองใหม่" }, 502);
  }

  const linked = await db.from("line_member_links").select("member_id")
    .eq("owner_id", shop.data.owner_id).eq("line_user_id", lineSubject).maybeSingle();
  if (linked.error) return json({ error: "ตรวจข้อมูลสมาชิกไม่สำเร็จ" }, 500);
  if (linked.data) {
    if (lineDisplayName) await db.from("line_member_links").update({ line_display_name: lineDisplayName,
      line_picture_url: linePictureUrl, profile_synced_at: new Date().toISOString() })
      .eq("owner_id", shop.data.owner_id).eq("line_user_id", lineSubject);
    const existing = await db.from("members").select("member_code,name,level,points,birth_date")
      .eq("owner_id", shop.data.owner_id).eq("id", linked.data.member_id).eq("status", "active").maybeSingle();
    if (existing.error || !existing.data) return json({ error: "บัญชีสมาชิกนี้ไม่พร้อมใช้งาน กรุณาติดต่อร้าน" }, 403);
    return json({ registered: true, member: publicMember(existing.data) });
  }

  if (input.action === "lookup") return json({ registered: false });
  const form = input.registration as Registration;
  const result = await db.rpc("register_line_member", {
    line_subject: lineSubject,
    first: form.firstName.trim(),
    last: form.lastName.trim(),
    member_gender: form.gender,
    birthday: form.birthDate,
    mobile: form.phone,
  });
  if (result.error) {
    if (result.error.message.includes("PHONE_ALREADY_REGISTERED") || result.error.code === "23505" && result.error.message.includes("phone"))
      return json({ error: "เบอร์นี้เป็นสมาชิกอยู่แล้ว กรุณาติดต่อร้านเพื่อยืนยันและผูกบัญชีเดิม" }, 409);
    if (result.error.code === "23505") return json({ error: "บัญชีนี้สมัครแล้ว กรุณาเปิดหน้าใหม่" }, 409);
    if (result.error.message.includes("INVALID_REGISTRATION")) return json({ error: "ข้อมูลสมัครไม่ถูกต้อง" }, 400);
    return json({ error: "สมัครสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง" }, 500);
  }
  if (lineDisplayName) await db.from("line_member_links").update({ line_display_name: lineDisplayName,
    line_picture_url: linePictureUrl, profile_synced_at: new Date().toISOString() })
    .eq("owner_id", shop.data.owner_id).eq("line_user_id", lineSubject);
  return json({ registered: true, member: publicMember(result.data as Record<string, unknown>) }, 201);
}
