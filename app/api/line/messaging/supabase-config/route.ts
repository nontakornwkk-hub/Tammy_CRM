import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { crmActor, noStore } from "@/lib/line/server";

export const runtime = "nodejs";

const keys = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"] as const;
type Key = typeof keys[number];

function parseUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 300) return null;
  try { const url = new URL(value.trim()); return url.protocol === "https:" && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url.toString()) ? url.origin : null; }
  catch { return null; }
}

async function check(url: string, publishable: string, secret: string) {
  const urlCheck = async () => {
    try {
      const response = await fetch(`${url}/auth/v1/health`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      return response.ok || response.status === 401;
    } catch { return false; }
  };
  const publishableCheck = async () => {
    if (!publishable) return false;
    try {
      const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: publishable }, cache: "no-store", signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch { return false; }
  };
  const secretCheck = async () => {
    if (!secret) return false;
    try {
      const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
      const response = await client.auth.admin.listUsers({ page: 1, perPage: 1 });
      return !response.error;
    } catch { return false; }
  };
  const [reachable, publishableValid, secretValid] = await Promise.all([urlCheck(), publishableCheck(), secretCheck()]);
  return { url: reachable, publishable: reachable && publishableValid, secret: reachable && secretValid };
}

export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้น" }, 403);
  const configured = { url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    publishable: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
    secret: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) };
  const url = parseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const checks = url ? await check(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "") : { url: false, publishable: false, secret: false };
  return noStore({ configured, checks, localSaveAvailable: process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname),
    projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "" });
}

export async function POST(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้น" }, 403);
  let input: Record<string, unknown>;
  try { const raw = await request.text(); if (raw.length > 12_000) return noStore({ error: "ข้อมูลยาวเกินไป" }, 413);
    input = JSON.parse(raw) as Record<string, unknown>; }
  catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  const url = parseUrl(input.url || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishable = typeof input.publishableKey === "string" ? input.publishableKey.trim() : process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const secret = typeof input.secretKey === "string" ? input.secretKey.trim() : process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || publishable.length > 4096 || secret.length > 4096) return noStore({ error: "ตรวจ Project URL และคีย์อีกครั้ง" }, 400);
  const checks = await check(url, publishable, secret);
  if (input.action !== "saveLocal") return noStore({ checks });
  if (process.env.NODE_ENV !== "development" || !["localhost", "127.0.0.1"].includes(new URL(request.url).hostname))
    return noStore({ error: "บันทึก .env.local ได้เฉพาะเครื่องพัฒนา ไม่ใช่ Vercel" }, 403);
  if (!checks.url || !checks.publishable || !checks.secret) return noStore({ checks, error: "ทดสอบให้ผ่านทั้ง 3 ค่าก่อนบันทึก" }, 400);
  const envPath = resolve(process.cwd(), ".env.local");
  const tempPath = resolve(process.cwd(), `.env.local.${randomUUID()}.tmp`);
  let existing = "";
  try { existing = await readFile(envPath, "utf8"); } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT") return noStore({ error: "อ่าน .env.local ไม่สำเร็จ" }, 500);
  }
  const updates: Record<Key, string> = { NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishable, SUPABASE_SECRET_KEY: secret };
  const retained = existing.split(/\r?\n/).filter(line => !keys.some(key => line.startsWith(`${key}=`)) && line.length > 0);
  const contents = [...retained, ...keys.map(key => `${key}=${JSON.stringify(updates[key])}`), ""].join("\n");
  try {
    await writeFile(tempPath, contents, { encoding: "utf8", flag: "wx", mode: 0o600 });
    await rename(tempPath, envPath);
    process.env.NEXT_PUBLIC_SUPABASE_URL = url;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = publishable;
    process.env.SUPABASE_SECRET_KEY = secret;
  } catch { return noStore({ error: "บันทึก .env.local ไม่สำเร็จ" }, 500); }
  return noStore({ checks, savedLocal: true, restartRecommended: true });
}
