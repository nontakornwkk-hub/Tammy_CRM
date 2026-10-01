import { createHash, timingSafeEqual } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type PosContext = { db: SupabaseClient; ownerId: string };
type PosAuthResult = { context: PosContext; response?: never } | { context?: never; response: Response };

export function posJson(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function authorizePos(request: Request): Promise<PosAuthResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey = process.env.POS_API_KEY;
  if (!url || !secret || !apiKey || apiKey.length < 32) {
    return { response: posJson({ error: "POS API is not configured", code: "POS_NOT_CONFIGURED" }, 503) };
  }

  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedHash = createHash("sha256").update(apiKey).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  if (!supplied || !timingSafeEqual(expectedHash, suppliedHash)) {
    return { response: posJson({ error: "Invalid API key", code: "UNAUTHORIZED" }, 401) };
  }

  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const slug = process.env.POS_SHOP_SLUG || "tammy";
  const shop = await db.from("public_shop_profiles").select("owner_id").eq("slug", slug).maybeSingle();
  if (shop.error || !shop.data) {
    return { response: posJson({ error: "POS shop is unavailable", code: "SHOP_UNAVAILABLE" }, 503) };
  }
  return { context: { db, ownerId: shop.data.owner_id as string } };
}

export function publicPosMember(member: Record<string, unknown>) {
  return {
    id: member.id,
    memberCode: member.member_code,
    name: member.name,
    phone: member.phone,
    level: member.level,
    points: member.points,
    totalSpending: member.spending,
    status: member.status,
  };
}
