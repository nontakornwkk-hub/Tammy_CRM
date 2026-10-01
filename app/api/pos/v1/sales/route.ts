import { authorizePos, posJson } from "@/lib/pos/api";

export const runtime = "nodejs";

type SaleInput = { externalSaleId: string; memberCode: string; saleAmount: string; note?: string };

function isSaleInput(value: unknown): value is SaleInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const sale = value as Record<string, unknown>;
  return typeof sale.externalSaleId === "string" && /^[A-Za-z0-9._:-]{1,120}$/.test(sale.externalSaleId)
    && typeof sale.memberCode === "string" && sale.memberCode.length > 0 && sale.memberCode.length <= 64
    && typeof sale.saleAmount === "string" && /^(?!0+(?:\.0{1,2})?$)\d{1,10}(?:\.\d{1,2})?$/.test(sale.saleAmount)
    && (sale.note === undefined || typeof sale.note === "string" && sale.note.length <= 200);
}

export async function POST(request: Request) {
  const auth = await authorizePos(request);
  if (auth.response) return auth.response;
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return posJson({ error: "Content-Type must be application/json", code: "INVALID_CONTENT_TYPE" }, 415);
  }

  let input: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 4096) return posJson({ error: "Request body is too large", code: "BODY_TOO_LARGE" }, 413);
    input = JSON.parse(raw);
  } catch {
    return posJson({ error: "Invalid JSON", code: "INVALID_JSON" }, 400);
  }
  if (!isSaleInput(input)) {
    return posJson({ error: "Invalid sale details", code: "INVALID_SALE" }, 400);
  }

  let member = await auth.context.db.from("members").select("id")
    .eq("owner_id", auth.context.ownerId).eq("member_code", input.memberCode).maybeSingle();
  if (!member.error && !member.data) member = await auth.context.db.from("members").select("id")
    .eq("owner_id", auth.context.ownerId).eq("previous_member_code", input.memberCode).maybeSingle();
  if (!member.error && !member.data) member = await auth.context.db.from("members").select("id")
    .eq("owner_id", auth.context.ownerId).eq("legacy_member_code", input.memberCode).maybeSingle();
  if (!member.error && !member.data) member = await auth.context.db.from("members").select("id")
    .eq("owner_id", auth.context.ownerId).eq("former_member_code", input.memberCode).maybeSingle();
  if (member.error) return posJson({ error: "Member lookup failed", code: "LOOKUP_FAILED" }, 502);
  if (!member.data) return posJson({ error: "Member not found", code: "MEMBER_NOT_FOUND" }, 404);

  const result = await auth.context.db.rpc("pos_record_sale", {
    p_owner_id: auth.context.ownerId,
    p_member_id: member.data.id,
    p_external_sale_id: input.externalSaleId,
    p_sale_amount: input.saleAmount,
    p_note: input.note || "",
  });
  if (result.error) {
    if (result.error.message.includes("POS_SALE_ID_REUSED"))
      return posJson({ error: "Sale ID already belongs to different details", code: "SALE_ID_REUSED" }, 409);
    if (result.error.message.includes("POS_MEMBER_NOT_FOUND"))
      return posJson({ error: "Active member not found", code: "MEMBER_NOT_FOUND" }, 404);
    if (result.error.message.includes("Points accumulation is disabled"))
      return posJson({ error: "Points accumulation is disabled", code: "POINTS_DISABLED" }, 409);
    if (result.error.code === "PGRST202")
      return posJson({ error: "POS database migration is pending", code: "POS_NOT_READY" }, 503);
    return posJson({ error: "Could not record sale", code: "SALE_FAILED" }, 502);
  }
  const sale = result.data as Record<string, unknown>;
  return posJson({ sale }, sale.replayed ? 200 : 201);
}
