import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { e164ToThaiPhone } from "@/lib/line/phone";

type Session = { db: SupabaseClient; ownerId: string; memberId: string };
type Failure = { error: string; status: number };

export async function verifiedMemberSession(input: { idToken?: string; otpAccessToken?: string }): Promise<Session | Failure> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return { error: "ระบบสมาชิกยังตั้งค่าเซิร์ฟเวอร์ไม่ครบ", status: 503 };
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const shop = await db.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").single();
  if (shop.error || !shop.data) return { error: "ไม่พบข้อมูลร้าน", status: 503 };
  const ownerId = shop.data.owner_id as string;

  if (input.otpAccessToken) {
    if (input.otpAccessToken.length < 20 || input.otpAccessToken.length > 8192) return { error: "กรุณายืนยัน OTP อีกครั้ง", status: 401 };
    const verified = await db.auth.getUser(input.otpAccessToken);
    const user = verified.data.user;
    const phone = user?.phone ? e164ToThaiPhone(user.phone) : null;
    if (verified.error || !phone || !user?.phone_confirmed_at) return { error: "กรุณายืนยัน OTP อีกครั้ง", status: 401 };
    const member = await db.from("members").select("id").eq("owner_id", ownerId).eq("phone", phone).eq("status", "active").maybeSingle();
    if (member.error || !member.data) return { error: "ไม่พบสมาชิกที่ใช้เบอร์นี้", status: 403 };
    return { db, ownerId, memberId: member.data.id };
  }

  const idToken = input.idToken || "";
  if (idToken.length < 20 || idToken.length > 8192) return { error: "กรุณาเข้าสู่ระบบ LINE อีกครั้ง", status: 401 };
  const connection = await db.from("line_connections").select("login_channel_id").eq("owner_id", ownerId).maybeSingle();
  const channelId = connection.data?.login_channel_id || process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) return { error: "ยังไม่เปิดใช้งาน LINE Login", status: 503 };
  try {
    const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { error: "กรุณาเข้าสู่ระบบ LINE อีกครั้ง", status: 401 };
    const identity = await response.json() as { aud?: string; sub?: string };
    if (identity.aud !== channelId || !identity.sub || !/^U[0-9a-f]{32}$/.test(identity.sub)) return { error: "บัญชี LINE ไม่ถูกต้อง", status: 401 };
    const linked = await db.from("line_member_links").select("member_id").eq("owner_id", ownerId).eq("line_user_id", identity.sub).maybeSingle();
    if (linked.error || !linked.data) return { error: "กรุณาสมัครสมาชิกก่อน", status: 403 };
    return { db, ownerId, memberId: linked.data.member_id };
  } catch { return { error: "ติดต่อ LINE ไม่สำเร็จ", status: 502 }; }
}
