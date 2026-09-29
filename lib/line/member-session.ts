import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { verifyMemberIdentity } from "./verify-member-identity";

type Session = { db: SupabaseClient; ownerId: string; memberId: string };
type Failure = { error: string; status: number };

export async function verifiedMemberSession(input: { idToken?: string; accessToken?: string }): Promise<Session | Failure> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return { error: "ระบบสมาชิกยังตั้งค่าเซิร์ฟเวอร์ไม่ครบ", status: 503 };
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const shop = await db.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").single();
  if (shop.error || !shop.data) return { error: "ไม่พบข้อมูลร้าน", status: 503 };
  const ownerId = shop.data.owner_id as string;

  if (!input.idToken && !input.accessToken) return { error: "กรุณาเข้าสู่ระบบ LINE อีกครั้ง", status: 401 };
  const connection = await db.from("line_connections").select("login_channel_id").eq("owner_id", ownerId).maybeSingle();
  const channelId = connection.data?.login_channel_id || process.env.LINE_LOGIN_CHANNEL_ID;
  if (!channelId) return { error: "ยังไม่เปิดใช้งาน LINE Login", status: 503 };
  try {
    const identity = await verifyMemberIdentity(input, channelId);
    if (!identity) return { error: "กรุณาเข้าสู่ระบบ LINE อีกครั้ง", status: 401 };
    const linked = await db.from("line_member_links").select("member_id").eq("owner_id", ownerId).eq("line_user_id", identity.sub).maybeSingle();
    if (linked.error || !linked.data) return { error: "กรุณาสมัครสมาชิกก่อน", status: 403 };
    const activeMember = await db.from("members").select("id").eq("owner_id", ownerId).eq("id", linked.data.member_id).eq("status", "active").maybeSingle();
    if (activeMember.error || !activeMember.data) return { error: "บัญชีสมาชิกนี้ไม่พร้อมใช้งาน กรุณาติดต่อร้าน", status: 403 };
    return { db, ownerId, memberId: linked.data.member_id };
  } catch { return { error: "ติดต่อ LINE ไม่สำเร็จ", status: 502 }; }
}
