import "server-only";
import type { MemberSession } from "./member-session";

type DataContext = Pick<MemberSession, "db" | "ownerId" | "memberId" | "catalogDb" | "catalogOwnerId">;

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function readMemberAccount({db, ownerId, memberId}: DataContext) {
    const [memberResult, pointsResult] = await Promise.all([
      db.from("members").select("member_code,name,first_name,last_name,gender,birth_date,birth_date_changed_at,phone,email,level,points,newsletter_opt_in,privacy_consent_updated_at,dog_count,cat_count,line_display_name,line_picture_url")
        .eq("owner_id", ownerId).eq("id", memberId).single(),
      db.from("points_transactions").select("id,points_delta,transaction_type,note,created_at")
        .eq("owner_id", ownerId).eq("member_id", memberId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(6),
    ]);
    if (memberResult.error || !memberResult.data || pointsResult.error)
      return json({ error: "โหลดข้อมูลสมาชิกไม่สำเร็จ" }, 500);
    const member = memberResult.data;
    return json({
      profile: {
        memberCode: member.member_code, name: member.name,
        firstName: member.first_name || member.name.split(" ")[0] || "",
        lastName: member.last_name || member.name.split(" ").slice(1).join(" "),
        gender: member.gender || "", birthDate: member.birth_date || "", birthdayChangedAt: member.birth_date_changed_at || "", phone: member.phone || "", email: member.email || "",
        level: member.level, points: member.points,
        dogCount: member.dog_count ?? 0, catCount: member.cat_count ?? 0,
        privacyConsent: Boolean(member.newsletter_opt_in), consentUpdatedAt: member.privacy_consent_updated_at || "",
        lineDisplayName: member.line_display_name || "", linePictureUrl: member.line_picture_url || "",
      },
      pointsHistory: (pointsResult.data || []).slice(0, 5),
      hasMore: (pointsResult.data || []).length > 5,
    });
  }
