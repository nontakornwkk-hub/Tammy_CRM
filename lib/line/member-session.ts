import "server-only";
import { createHash } from "node:crypto";
import { singleFlight } from "@/lib/single-flight";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { memberShopContext } from "./shop-context";
import { verifyMemberIdentity } from "./verify-member-identity";
import { testAdminContext, testMemberMarker } from "./test-member-session";

export type MemberSession = { db: SupabaseClient; ownerId: string; memberId: string; catalogDb?: SupabaseClient; catalogOwnerId?: string; birthday: { birth_date: string | null; birth_date_changed_at: string | null } };
type Session = MemberSession;
type Failure = { error: string; status: number };
const pendingSessions = singleFlight<Session | Failure>();

export async function verifiedMemberSession(input: { idToken?: string; accessToken?: string }): Promise<Session | Failure> {
  const key = createHash("sha256").update(JSON.stringify([input.idToken || "", input.accessToken || ""])).digest("hex");
  return pendingSessions(key, () => resolveMemberSession(input));
}

async function resolveMemberSession(input: { idToken?: string; accessToken?: string }): Promise<Session | Failure> {
  if (input.accessToken?.startsWith("test:")) {
    const test = await testAdminContext(input.accessToken.slice(5));
    if (!test) return { error: "โหมดทดสอบไม่พร้อมใช้งานหรือเซสชันแอดมินหมดอายุ", status: 403 };
    const member = await test.db.from("members").select("id,birth_date,birth_date_changed_at").eq("owner_id", test.ownerId)
      .eq("notes", testMemberMarker).eq("status", "active").maybeSingle();
    if (!member.data) return { error: "ไม่พบสมาชิกทดสอบ กรุณาเปิดหน้าทดสอบใหม่", status: 404 };
    return { db: test.db, ownerId: test.ownerId, memberId: member.data.id, catalogDb: test.catalogDb, catalogOwnerId: test.catalogOwnerId, birthday: { birth_date: member.data.birth_date, birth_date_changed_at: member.data.birth_date_changed_at } };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) return { error: "ระบบสมาชิกยังตั้งค่าเซิร์ฟเวอร์ไม่ครบ", status: 503 };
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  if (!input.idToken && !input.accessToken) return { error: "กรุณาเข้าสู่ระบบ LINE อีกครั้ง", status: 401 };
  let ownerId:string,channelId:string;
  try { ({ownerId,channelId}=await memberShopContext(db)); }
  catch(cause) { return {error:(cause as Error).message,status:503}; }
  try {
    const identity = await verifyMemberIdentity(input, channelId);
    if (!identity) return { error: "กรุณาเข้าสู่ระบบ LINE อีกครั้ง", status: 401 };
    // LINE identity and membership now live in the same row.
    const linked = await db.from("members").select("id,birth_date,birth_date_changed_at")
      .eq("owner_id", ownerId).eq("line_user_id", identity.sub)
      .eq("status", "active").maybeSingle();
    if (linked.error || !linked.data) return { error: "กรุณาสมัครสมาชิกก่อน", status: 403 };
    const member = linked.data;
    if (!member) return { error: "บัญชีสมาชิกนี้ไม่พร้อมใช้งาน กรุณาติดต่อร้าน", status: 403 };
    return { db, ownerId, memberId: linked.data.id, birthday: { birth_date: member.birth_date, birth_date_changed_at: member.birth_date_changed_at } };
  } catch { return { error: "ติดต่อ LINE ไม่สำเร็จ", status: 502 }; }
}
