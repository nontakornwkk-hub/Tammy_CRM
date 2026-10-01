import { verifyMemberIdentity } from "@/lib/line/verify-member-identity";
import { noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const db = serviceDb();
  if (!db) return noStore({ error: "ระบบยังไม่พร้อมใช้งาน" }, 503);
  let input: { requestId?: string; idToken?: string; accessToken?: string };
  try {
    const raw = await request.text();
    if (raw.length > 8192) return noStore({ error: "ข้อมูลยาวเกินไป" }, 413);
    input = JSON.parse(raw);
  } catch { return noStore({ error: "คำขอไม่ถูกต้อง" }, 400); }
  if (!/^[0-9a-f-]{36}$/i.test(input.requestId || "")) return noStore({ error: "QR ไม่ถูกต้อง" }, 400);
  if (!input.idToken && !input.accessToken) return noStore({ error: "กรุณาเข้าสู่ระบบ LINE ก่อน" }, 401);
  const requestRow = await db.from("line_member_transfer_requests")
    .select("id,owner_id,member_id,status").eq("id", input.requestId).maybeSingle();
  if (requestRow.error || !requestRow.data || requestRow.data.status !== "waiting")
    return noStore({ error: "คำขอนี้ใช้งานไม่ได้แล้ว กรุณาให้ร้านสร้างใหม่" }, 409);
  const connection = await db.from("line_connections").select("login_channel_id")
    .eq("owner_id", requestRow.data.owner_id).maybeSingle();
  const channelId = connection.data?.login_channel_id || process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) return noStore({ error: "ร้านยังไม่ได้ตั้งค่า LINE Login" }, 503);
  let identity: Awaited<ReturnType<typeof verifyMemberIdentity>>;
  try { identity = await verifyMemberIdentity(input, channelId); }
  catch { return noStore({ error: "ตรวจสอบบัญชี LINE ไม่สำเร็จ" }, 502); }
  if (!identity) return noStore({ error: "กรุณาเข้าสู่ระบบ LINE อีกครั้ง" }, 401);
  const existing = await db.from("line_member_links").select("member_id")
    .eq("owner_id", requestRow.data.owner_id).eq("line_user_id", identity.sub).maybeSingle();
  if (existing.error) return noStore({ error: "ตรวจบัญชี LINE ไม่สำเร็จ" }, 500);
  if (existing.data) return noStore({ error: "LINE นี้เชื่อมกับสมาชิกอยู่แล้ว กรุณาให้ร้านตรวจสอบ" }, 409);
  const updated = await db.from("line_member_transfer_requests").update({
    status: "claimed", new_line_user_id: identity.sub,
    new_line_display_name: identity.name?.slice(0, 120) || null,
    new_line_picture_url: identity.picture?.startsWith("https://") ? identity.picture : null,
    claimed_at: new Date().toISOString(),
  }).eq("id", requestRow.data.id).eq("owner_id", requestRow.data.owner_id)
    .eq("status", "waiting").is("new_line_user_id", null).select("id").maybeSingle();
  if (updated.error || !updated.data) return noStore({ error: "คำขอนี้ถูกใช้งานแล้ว กรุณาให้ร้านตรวจสอบ" }, 409);
  return noStore({ success: true });
}
