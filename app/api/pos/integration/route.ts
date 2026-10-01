import { crmActor, noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

function publicBaseUrl(request: Request) {
  for (const value of [process.env.POS_PUBLIC_BASE_URL, process.env.LINE_WEBHOOK_BASE_URL, new URL(request.url).origin]) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:" && !url.username && !url.password
        && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return url.origin;
    } catch { /* Continue to the configured public fallback. */ }
  }
  return "https://tammy-crm.vercel.app";
}

async function publicApiReady(baseUrl: string, request: Request, configured: boolean) {
  if (!configured) return false;
  if (baseUrl === new URL(request.url).origin) return true;
  try {
    const response = await fetch(`${baseUrl}/api/pos/v1/members?memberCode=POS_CONNECTIVITY_CHECK`,
      { cache: "no-store", signal: AbortSignal.timeout(3500) });
    if (response.status !== 401) return false;
    const body = await response.json() as { code?: string };
    return body.code === "UNAUTHORIZED";
  } catch { return false; }
}

async function ownerIntegration(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return { response: noStore({ error: "เฉพาะเจ้าของร้านเท่านั้นที่ดูข้อมูล POS API ได้" }, 403) };
  const db = serviceDb();
  if (!db) return { response: noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า Supabase" }, 503) };
  const slug = process.env.POS_SHOP_SLUG || "tammy";
  const shop = await db.from("public_shop_profiles").select("owner_id").eq("slug", slug).maybeSingle();
  if (shop.error || !shop.data) return { response: noStore({ error: "ยังไม่พบร้านที่เชื่อมกับ POS API" }, 503) };
  if (shop.data.owner_id !== actor.ownerId) return { response: noStore({ error: "POS API นี้เป็นของร้านอื่น" }, 403) };
  return { slug };
}

export async function GET(request: Request) {
  const result = await ownerIntegration(request);
  if (result.response) return result.response;
  const key = process.env.POS_API_KEY;
  const configured = Boolean(key && key.length >= 32);
  const baseUrl = publicBaseUrl(request);
  return noStore({ configured, publicReady: await publicApiReady(baseUrl, request, configured),
    shopSlug: result.slug, baseUrl, version: "v1" });
}

export async function POST(request: Request) {
  const result = await ownerIntegration(request);
  if (result.response) return result.response;
  const key = process.env.POS_API_KEY;
  if (!key || key.length < 32) return noStore({ error: "ยังไม่ได้ตั้งค่า POS_API_KEY บนเซิร์ฟเวอร์" }, 503);
  let input: unknown;
  try { input = await request.json(); } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  if (!input || typeof input !== "object" || (input as { action?: unknown }).action !== "reveal")
    return noStore({ error: "คำขอไม่ถูกต้อง" }, 400);
  return noStore({ apiKey: key });
}
