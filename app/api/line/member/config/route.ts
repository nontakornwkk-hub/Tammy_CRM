import { noStore, serviceDb } from "@/lib/line/server";
import { memberShopContext } from "@/lib/line/shop-context";
import { liffMatchesLoginChannel } from "@/lib/line/login-channel";

export const runtime = "nodejs";

export async function GET() {
  const db = serviceDb();
  if (!db) return noStore({ error: "ระบบสมาชิก LINE ยังตั้งค่าเซิร์ฟเวอร์ไม่ครบ" }, 503);
  let liffId:string|null,loginChannelId:string,logoUrl:string|null;
  try { const context=await memberShopContext(db);liffId=context.liffId;loginChannelId=context.channelId;logoUrl=context.logoUrl; }
  catch(cause) { return noStore({error:(cause as Error).message},503); }
  if (!liffId || !loginChannelId) return noStore({ error: "ยังไม่ได้ตั้งค่า LINE Login และ LIFF" }, 503);
  if (!liffMatchesLoginChannel(loginChannelId, liffId)) return noStore({ error: "LINE Login Channel ID ไม่ตรงกับ LIFF ID กรุณาแก้การเชื่อมต่อ LINE" }, 503);
  return Response.json({ liffId, logoUrl }, { headers: { "Cache-Control":"public, max-age=60, s-maxage=60, stale-while-revalidate=60" } });
}
