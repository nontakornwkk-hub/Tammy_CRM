import { verifiedMemberSession } from "@/lib/line/member-session";

export const runtime = "nodejs";

type Input = {
  action?: string; idToken?: string; memberCode?: string;
  profile?: { firstName?: string; lastName?: string; gender?: string; birthDate?: string; phone?: string; email?: string };
};

const genders = new Set(["male", "female", "other", "prefer_not_to_say"]);

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    && value >= "1900-01-01" && value <= new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  let input: Input;
  try {
    const raw = await request.text();
    if (raw.length > 12_000) return json({ error: "ข้อมูลมีขนาดใหญ่เกินไป" }, 413);
    input = JSON.parse(raw) as Input;
  } catch { return json({ error: "คำขอไม่ถูกต้อง" }, 400); }
  if (!input || !["load", "update", "delete"].includes(input.action || "")) return json({ error: "คำขอไม่ถูกต้อง" }, 400);

  const session = await verifiedMemberSession(input);
  if ("error" in session) return json({ error: session.error }, session.status);
  const { db, ownerId, memberId } = session;

  if (input.action === "load") {
    const [memberResult, linkResult, pointsResult, redemptionResult] = await Promise.all([
      db.from("members").select("member_code,name,first_name,last_name,gender,birth_date,phone,email,level,points")
        .eq("owner_id", ownerId).eq("id", memberId).single(),
      db.from("line_member_links").select("line_display_name,line_picture_url")
        .eq("owner_id", ownerId).eq("member_id", memberId).maybeSingle(),
      db.from("points_transactions").select("id,points_delta,transaction_type,note,created_at")
        .eq("owner_id", ownerId).eq("member_id", memberId).order("created_at", { ascending: false }).limit(50),
      db.from("redemptions").select("id,reward_id,coupon_id,points_spent,status,redeemed_at")
        .eq("owner_id", ownerId).eq("member_id", memberId).order("redeemed_at", { ascending: false }).limit(50),
    ]);
    if (memberResult.error || !memberResult.data || linkResult.error || pointsResult.error || redemptionResult.error)
      return json({ error: "โหลดข้อมูลสมาชิกไม่สำเร็จ" }, 500);

    const redemptions = redemptionResult.data || [];
    const rewardIds = redemptions.map(item => item.reward_id).filter((id): id is string => Boolean(id));
    const couponIds = redemptions.map(item => item.coupon_id).filter((id): id is string => Boolean(id));
    const [rewardResult, couponResult] = await Promise.all([
      rewardIds.length ? db.from("rewards").select("id,title").eq("owner_id", ownerId).in("id", rewardIds) : Promise.resolve({ data: [], error: null }),
      couponIds.length ? db.from("coupons").select("id,title").eq("owner_id", ownerId).in("id", couponIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (rewardResult.error || couponResult.error) return json({ error: "โหลดประวัติการแลกไม่สำเร็จ" }, 500);
    const rewardTitles = new Map((rewardResult.data || []).map(item => [item.id, item.title]));
    const couponTitles = new Map((couponResult.data || []).map(item => [item.id, item.title]));
    const member = memberResult.data;
    return json({
      profile: {
        memberCode: member.member_code, name: member.name,
        firstName: member.first_name || member.name.split(" ")[0] || "",
        lastName: member.last_name || member.name.split(" ").slice(1).join(" "),
        gender: member.gender || "", birthDate: member.birth_date || "", phone: member.phone || "", email: member.email || "",
        level: member.level, points: member.points,
        lineDisplayName: linkResult.data?.line_display_name || "", linePictureUrl: linkResult.data?.line_picture_url || "",
      },
      pointsHistory: pointsResult.data || [],
      redemptions: redemptions.map(item => ({
        id: item.id, kind: item.coupon_id ? "coupon" : "reward", title: item.coupon_id
          ? couponTitles.get(item.coupon_id) || "คูปอง" : rewardTitles.get(item.reward_id || "") || "ของรางวัล",
        pointsSpent: item.points_spent, status: item.status, redeemedAt: item.redeemed_at,
      })),
    });
  }

  if (input.action === "update") {
    const profile = input.profile;
    const firstName = profile?.firstName?.trim() || "";
    const lastName = profile?.lastName?.trim() || "";
    const phone = profile?.phone?.replace(/\D/g, "") || "";
    const email = profile?.email?.trim().toLowerCase() || "";
    const gender = profile?.gender || "";
    const birthDate = profile?.birthDate || "";
    if (!firstName || firstName.length > 80 || !lastName || lastName.length > 80 || !/^0\d{9}$/.test(phone)
      || gender && !genders.has(gender) || birthDate && !validDate(birthDate)
      || email.length > 254 || email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: "กรุณาตรวจชื่อ เบอร์โทร วันเกิด และอีเมลอีกครั้ง" }, 400);
    const updated = await db.from("members").update({
      name: `${firstName} ${lastName}`, first_name: firstName, last_name: lastName,
      gender: gender || null, birth_date: birthDate || null, phone, email: email || null, updated_at: new Date().toISOString(),
    }).eq("owner_id", ownerId).eq("id", memberId).eq("status", "active").select("name").single();
    if (updated.error?.code === "23505") return json({ error: "เบอร์โทรนี้มีสมาชิกใช้อยู่แล้ว กรุณาใช้เบอร์อื่น" }, 409);
    if (updated.error || !updated.data) return json({ error: "บันทึกข้อมูลไม่สำเร็จ กรุณาลองอีกครั้ง" }, 500);
    return json({ success: true, name: updated.data.name });
  }

  const member = await db.from("members").select("member_code").eq("owner_id", ownerId).eq("id", memberId).single();
  if (member.error || !member.data) return json({ error: "ไม่พบบัญชีสมาชิก" }, 404);
  if (input.memberCode !== member.data.member_code) return json({ error: "กรุณากรอกรหัสสมาชิกให้ตรงก่อนลบบัญชี" }, 400);
  const deleted = await db.rpc("delete_line_member_account", { p_owner_id: ownerId, p_member_id: memberId });
  if (deleted.error || deleted.data !== true) return json({ error: "ลบบัญชีไม่สำเร็จ กรุณาติดต่อร้าน" }, 500);
  return json({ success: true });
}
