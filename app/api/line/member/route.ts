import { after } from "next/server";
import { memberShopContext } from "@/lib/line/shop-context";
import { createClient } from "@supabase/supabase-js";
import { verifyMemberIdentity } from "@/lib/line/verify-member-identity";

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

function publicMember(member: Record<string, unknown>, linePictureUrl: string | null) {
  return {
    memberCode: member.member_code,
    name: member.name,
    level: member.level,
    points: member.points,
    birthDate: member.birth_date,
    linePictureUrl,
  };
}

export async function POST(request: Request) {
  const started=performance.now();
  const reply=(body:Record<string,unknown>,status=200)=>{const response=json(body,status);response.headers.set("Server-Timing",`total;dur=${(performance.now()-started).toFixed(1)}`);return response;};
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !secretKey) return reply({ error: "ระบบสมัครผ่าน LINE ยังตั้งค่าไม่ครบ" }, 503);
  const db = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  let ownerId:string,channelId:string;
  try { ({ownerId,channelId}=await memberShopContext(db)); }
  catch(cause) { return reply({error:(cause as Error).message},503); }

  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return reply({ error: "ข้อมูลที่ส่งมีขนาดใหญ่เกินไป" }, 413);
    input = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return reply({ error: "รูปแบบข้อมูลไม่ถูกต้อง" }, 400);
  }
  if ((!input.idToken || typeof input.idToken !== "string") && (!input.accessToken || typeof input.accessToken !== "string"))
    return reply({ error: "กรุณาเข้าสู่ระบบผ่าน LINE อีกครั้ง" }, 401);
  if (input.action !== "lookup" && input.action !== "register") return reply({ error: "คำขอไม่ถูกต้อง" }, 400);
  if (input.action === "register" && !validRegistration(input.registration))
    return reply({ error: "กรุณากรอกข้อมูลให้ครบและตรวจสอบเบอร์โทรกับวันเกิด" }, 400);

  let lineSubject: string;
  let lineDisplayName: string | null = null;
  let linePictureUrl: string | null = null;
  try {
    const identity = await verifyMemberIdentity({ idToken: typeof input.idToken === "string" ? input.idToken : undefined, accessToken: typeof input.accessToken === "string" ? input.accessToken : undefined }, channelId);
    if (!identity) return reply({ error: "เซสชัน LINE หมดอายุหรือไม่ตรงกับช่องทางที่เชื่อมไว้ กรุณาเข้าสู่ LINE อีกครั้ง", errorCode: "LINE_ID_TOKEN_REJECTED" }, 401);
    lineSubject = identity.sub;
    lineDisplayName = identity.name?.slice(0, 120) || null;
    linePictureUrl = identity.picture?.startsWith("https://") ? identity.picture : null;
  } catch {
    return reply({ error: "ติดต่อ LINE ไม่สำเร็จ กรุณาลองใหม่" }, 502);
  }

  const linked = await db.from("members").select("id,line_picture_url,line_display_name,member_code,name,level,points,birth_date,status")
    .eq("owner_id", ownerId).eq("line_user_id", lineSubject).maybeSingle();
  if (linked.error) return reply({ error: "ตรวจข้อมูลสมาชิกไม่สำเร็จ" }, 500);
  if (linked.data) {
    const existing = linked.data;
    if (!existing || existing.status !== "active") return reply({ error: "บัญชีสมาชิกนี้ไม่พร้อมใช้งาน กรุณาติดต่อร้าน" }, 403);
    // Avoid writing the same LINE profile on every login.
    if ((lineDisplayName && lineDisplayName !== linked.data.line_display_name) || (linePictureUrl && linePictureUrl !== linked.data.line_picture_url)) {
      after(async () => {
        const synced=await db.from("members").update({
          ...(lineDisplayName ? {line_display_name:lineDisplayName}:{}),
          ...(linePictureUrl ? {line_picture_url:linePictureUrl}:{}),
          line_profile_synced_at:new Date().toISOString(),
        }).eq("owner_id",ownerId).eq("line_user_id",lineSubject);
        if(synced.error)console.warn("LINE profile sync failed",{code:synced.error.code});
      });
    }
    return reply({ registered: true, member: publicMember(existing, linePictureUrl || linked.data.line_picture_url) });
  }

  if (input.action === "lookup") return reply({ registered: false });
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
      return reply({ error: "เบอร์นี้เป็นสมาชิกอยู่แล้ว กรุณาติดต่อร้านเพื่อยืนยันและผูกบัญชีเดิม" }, 409);
    if (result.error.code === "23505") return reply({ error: "บัญชีนี้สมัครแล้ว กรุณาเปิดหน้าใหม่" }, 409);
    if (result.error.message.includes("INVALID_REGISTRATION")) return reply({ error: "ข้อมูลสมัครไม่ถูกต้อง" }, 400);
    return reply({ error: "สมัครสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง" }, 500);
  }
  if (lineDisplayName) await db.from("members").update({ line_display_name: lineDisplayName,
    line_picture_url: linePictureUrl, line_profile_synced_at: new Date().toISOString() })
    .eq("owner_id", ownerId).eq("line_user_id", lineSubject);
  return reply({ registered: true, member: publicMember(result.data as Record<string, unknown>, linePictureUrl) }, 201);
}
