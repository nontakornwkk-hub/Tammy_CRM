import { authorizePos, posJson, publicPosMember } from "@/lib/pos/api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await authorizePos(request);
  if (auth.response) return auth.response;

  const params = new URL(request.url).searchParams;
  const memberCode = params.get("memberCode")?.trim();
  const phone = params.get("phone")?.trim();
  if (Boolean(memberCode) === Boolean(phone) || memberCode && memberCode.length > 64
    || phone && !/^0\d{9}$/.test(phone)) {
    return posJson({ error: "Provide one valid memberCode or phone", code: "INVALID_LOOKUP" }, 400);
  }

  const query = () => auth.context.db.from("members")
    .select("id,member_code,name,phone,level,points,spending,status")
    .eq("owner_id", auth.context.ownerId);
  let result = await (memberCode ? query().eq("member_code", memberCode) : query().eq("phone", phone!)).maybeSingle();
  if (memberCode && !result.error && !result.data) result = await query().eq("previous_member_code", memberCode).maybeSingle();
  if (memberCode && !result.error && !result.data) result = await query().eq("legacy_member_code", memberCode).maybeSingle();
  if (memberCode && !result.error && !result.data) result = await query().eq("former_member_code", memberCode).maybeSingle();
  if (result.error) return posJson({ error: "Member lookup failed", code: "LOOKUP_FAILED" }, 502);
  if (!result.data) return posJson({ error: "Member not found", code: "MEMBER_NOT_FOUND" }, 404);
  return posJson({ member: publicPosMember(result.data) });
}
