import { noStore, serviceDb } from "@/lib/line/server";
import { liffMatchesLoginChannel } from "@/lib/line/login-channel";

export const runtime = "nodejs";

export async function GET() {
  const db = serviceDb();
  if (!db) return noStore({ error: "ระบบสมาชิก LINE ยังตั้งค่าเซิร์ฟเวอร์ไม่ครบ" }, 503);
  const shop = await db.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").maybeSingle();
  if (shop.error || !shop.data) return noStore({ error: "ไม่พบข้อมูลร้าน" }, 503);
  const connection = await db.from("line_connections").select("liff_id,login_channel_id")
    .eq("owner_id", shop.data.owner_id).maybeSingle();
  if (connection.error) return noStore({ error: "ยังไม่พร้อมเชื่อม LINE" }, 503);
  const liffId = connection.data?.liff_id || process.env.NEXT_PUBLIC_LINE_LIFF_ID;
  const loginChannelId = connection.data?.login_channel_id || process.env.LINE_LOGIN_CHANNEL_ID;
  if (!liffId || !loginChannelId) return noStore({ error: "ยังไม่ได้ตั้งค่า LINE Login และ LIFF" }, 503);
  if (!liffMatchesLoginChannel(loginChannelId, liffId)) return noStore({ error: "LINE Login Channel ID ไม่ตรงกับ LIFF ID กรุณาแก้การเชื่อมต่อ LINE" }, 503);
  return noStore({ liffId });
}
