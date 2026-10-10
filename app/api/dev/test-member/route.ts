import { randomUUID } from "node:crypto";
import { noStore } from "@/lib/line/server";
import { testAdminContext, testMemberMarker } from "@/lib/line/test-member-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
  const test = await testAdminContext(token);
  if (!test) return noStore({ error: "โหมดทดสอบใช้ได้เฉพาะแอดมินบนเซิร์ฟเวอร์พัฒนา" }, 403);
  if(new URL(request.url).searchParams.get("confirmPhone")==="1") {
    const phone=new URL(request.url).searchParams.get("phone") || "";
    if(!/^0\d{9}$/.test(phone)) return noStore({error:"กรุณากรอกเบอร์โทรศัพท์ 10 หลัก"},400);
    const check=await test.db.from("members").select("id").eq("owner_id",test.ownerId).eq("notes",testMemberMarker).eq("status","active").eq("phone",phone).maybeSingle();
    if(check.error || !check.data) return noStore({error:"เบอร์โทรไม่ตรงกับสมาชิกทดสอบ"},403);
  }
  let member = await test.db.from("members").select("id,member_code,name,level,points")
    .eq("owner_id", test.ownerId).eq("notes", testMemberMarker).eq("status", "active").maybeSingle();
  if (member.error) return noStore({ error: "โหลดสมาชิกทดสอบไม่สำเร็จ" }, 500);
  if (!member.data) {
    member = await test.db.from("members").insert({
      owner_id: test.ownerId, member_code: "TMTEST", name: "คุณแอดมิน", first_name: "คุณ", last_name: "แอดมิน",
      phone: "0990000000", level: "Member", points: 900, spending: 0, status: "active",
      newsletter_opt_in: false, notes: testMemberMarker, tags: ["บัญชีทดสอบ"],
    }).select("id,member_code,name,level,points").single();
    if (member.error || !member.data) return noStore({ error: "สร้างสมาชิกทดสอบไม่สำเร็จ" }, 500);
    await test.db.from("members").update({
      line_user_id: `U${randomUUID().replaceAll("-", "")}`,
      line_display_name: "LINE ทดสอบของแอดมิน",
      line_linked_at: new Date().toISOString(),
    }).eq("owner_id", test.ownerId).eq("id", member.data.id);
  }
  return noStore({ member: {
    memberCode: member.data.member_code, name: member.data.name, level: member.data.level,
    points: member.data.points, linePictureUrl: null,
  } });
}

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer /, "");
  const test = await testAdminContext(token);
  if (!test) return noStore({ error: "ไม่มีสิทธิ์ใช้บัญชีทดสอบ" }, 403);
  let action: string;
  try { action = (await request.json() as { action?: string }).action || ""; }
  catch { return noStore({ error: "คำขอไม่ถูกต้อง" }, 400); }
  if (action !== "addPoints" && action !== "reset") return noStore({ error: "คำขอไม่ถูกต้อง" }, 400);
  const member = await test.db.from("members").select("id,points").eq("owner_id", test.ownerId)
    .eq("notes", testMemberMarker).eq("status", "active").maybeSingle();
  if (!member.data) return noStore({ error: "ไม่พบบัญชีทดสอบ" }, 404);
  if (action === "addPoints") {
    const updated = await test.db.from("members").update({ points: member.data.points + 500 })
      .eq("owner_id", test.ownerId).eq("id", member.data.id).select("points").single();
    if (updated.error) return noStore({ error: "เติมแต้มทดสอบไม่สำเร็จ" }, 500);
    await test.db.from("points_transactions").insert({
      owner_id: test.ownerId, member_id: member.data.id, points_delta: 500,
      sale_amount: 0, transaction_type: "adjustment", note: "เติมแต้มในโหมดทดสอบ",
    });
    return noStore({ success: true });
  }
  const results = await Promise.all([
    test.db.from("member_coupon_claims").delete().eq("owner_id", test.ownerId).eq("member_id", member.data.id),
    test.db.from("redemptions").delete().eq("owner_id", test.ownerId).eq("member_id", member.data.id),
    test.db.from("points_transactions").delete().eq("owner_id", test.ownerId).eq("member_id", member.data.id),
  ]);
  if (results.some(result => result.error)) return noStore({ error: "ล้างประวัติทดสอบไม่สำเร็จ" }, 500);
  const reset = await test.db.from("members").update({ points: 900, spending: 0 })
    .eq("owner_id", test.ownerId).eq("id", member.data.id).select("id").single();
  if (reset.error) return noStore({ error: "รีเซ็ตแต้มทดสอบไม่สำเร็จ" }, 500);
  return noStore({ success: true });
}
