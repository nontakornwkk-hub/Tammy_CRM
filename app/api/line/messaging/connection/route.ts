import { crmActor, lineConnection, noStore, safeLineUrl, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

type Bot = { userId: string; displayName: string; basicId: string };

async function botInfo(token: string): Promise<Bot | null> {
  try {
    const result = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!result.ok) return null;
    const data = await result.json() as Bot;
    return /^U[0-9a-f]{32}$/.test(data.userId) ? data : null;
  } catch { return null; }
}

async function tokenChannelId(token: string): Promise<string | null> {
  try {
    const result = await fetch("https://api.line.me/v2/oauth/verify", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ access_token: token }), cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (result.ok) return ((await result.json()) as { client_id?: string }).client_id || null;
    const alternate = await fetch(`https://api.line.me/oauth2/v2.1/verify?${new URLSearchParams({ access_token: token })}`, {
      cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (alternate.ok) return ((await alternate.json()) as { client_id?: string }).client_id || null;
  } catch { /* Bot info remains the connection check for other token formats. */ }
  return null;
}

async function webhookStatus(token: string) {
  try {
    const response = await fetch("https://api.line.me/v2/bot/channel/webhook/endpoint", {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return await response.json() as { endpoint: string; active: boolean };
  } catch { return null; }
}

export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้นที่จัดการการเชื่อมต่อได้" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  try {
    const connection = await lineConnection(db, actor.ownerId);
    const envToken = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
    const token = connection?.access_token || envToken;
    const bot = token ? await botInfo(token) : null;
    const webhook = token && bot ? await webhookStatus(token) : null;
    return noStore({
      connected: Boolean(connection && bot), source: connection ? "saved" : envToken ? "environment" : "none",
      channelId: connection?.channel_id || "", loginChannelId: connection?.login_channel_id || process.env.LINE_LOGIN_CHANNEL_ID || "",
      liffId: connection?.liff_id || process.env.NEXT_PUBLIC_LINE_LIFF_ID || "", bot: bot ? { displayName: bot.displayName, basicId: bot.basicId } : null,
      channelSecret: Boolean(connection?.channel_secret || process.env.LINE_MESSAGING_CHANNEL_SECRET),
      accessToken: Boolean(token), membershipUrl: connection?.membership_url || process.env.LINE_MEMBERSHIP_URL || "",
      webhook, liff: Boolean((connection?.liff_id || process.env.NEXT_PUBLIC_LINE_LIFF_ID) && (connection?.login_channel_id || process.env.LINE_LOGIN_CHANNEL_ID)),
      server: { supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL), publishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY), secretKey: Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) },
    });
  } catch { return noStore({ error: "อ่านการเชื่อมต่อไม่สำเร็จ ตรวจว่า migration ถูกติดตั้งแล้ว" }, 500); }
}

export async function POST(request: Request) {
  const actor = await crmActor(request);
  if (!actor || actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านเท่านั้นที่เชื่อม LINE ได้" }, 403);
  const db = serviceDb();
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  let input: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > 12_000) return noStore({ error: "ข้อมูลมีขนาดใหญ่เกินไป" }, 413);
    input = JSON.parse(raw) as Record<string, unknown>;
  } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  if (input.action === "login") {
    const loginChannelId = typeof input.loginChannelId === "string" ? input.loginChannelId.trim() : "";
    const liffId = typeof input.liffId === "string" ? input.liffId.trim() : "";
    if (!/^\d{5,20}$/.test(loginChannelId) || !/^\d{5,20}-[\w-]{4,40}$/.test(liffId))
      return noStore({ error: "ตรวจ LINE Login Channel ID และ LIFF ID อีกครั้ง" }, 400);
    const existing = await lineConnection(db, actor.ownerId);
    if (!existing) return noStore({ error: "กรุณาเชื่อม Messaging API ก่อน" }, 409);
    const saved = await db.from("line_connections").update({ login_channel_id: loginChannelId, liff_id: liffId,
      updated_at: new Date().toISOString() }).eq("owner_id", actor.ownerId);
    if (saved.error) return noStore({ error: "บันทึก LINE Login ไม่สำเร็จ" }, 500);
    return noStore({ connected: true, loginChannelId, liffId, liff: true,
      message: "บันทึก LINE Login / LIFF แล้ว กรุณาตรวจ Endpoint URL ใน LINE Developers และทดสอบสมัครผ่าน LINE จริง" });
  }
  const channelId = typeof input.channelId === "string" ? input.channelId.trim() : "";
  const channelSecret = typeof input.channelSecret === "string" ? input.channelSecret.trim() : "";
  const accessToken = typeof input.accessToken === "string" ? input.accessToken.trim() : "";
  const loginChannelId = typeof input.loginChannelId === "string" ? input.loginChannelId.trim() : "";
  const liffId = typeof input.liffId === "string" ? input.liffId.trim() : "";
  const membershipUrl = input.membershipUrl === "" ? null : safeLineUrl(typeof input.membershipUrl === "string" ? input.membershipUrl : null);
  if (!/^\d{5,20}$/.test(channelId) || !/^[0-9a-f]{32}$/i.test(channelSecret) || !accessToken || accessToken.length > 4096 || input.membershipUrl && !membershipUrl || loginChannelId && !/^\d{5,20}$/.test(loginChannelId) || liffId && !/^[\w-]{5,40}$/.test(liffId))
    return noStore({ error: "ตรวจ Channel ID, Channel Secret, Access Token และลิงก์สมาชิกอีกครั้ง" }, 400);

  const bot = await botInfo(accessToken);
  if (!bot) return noStore({ error: "LINE ไม่ยอมรับ Channel Access Token นี้" }, 400);
  const verifiedChannelId = await tokenChannelId(accessToken);
  if (verifiedChannelId && verifiedChannelId !== channelId)
    return noStore({ error: "Channel ID ไม่ตรงกับ Access Token ที่ให้มา" }, 400);

  const saved = await db.from("line_connections").upsert({
    owner_id: actor.ownerId, channel_id: channelId, channel_secret: channelSecret,
    access_token: accessToken, bot_user_id: bot.userId, bot_display_name: bot.displayName,
    bot_basic_id: bot.basicId, membership_url: membershipUrl,
    ...(loginChannelId ? { login_channel_id: loginChannelId } : {}), ...(liffId ? { liff_id: liffId } : {}),
    connected_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: "owner_id" });
  if (saved.error) return noStore({ error: "บันทึกการเชื่อมต่อไม่สำเร็จ" }, 500);

  const configuredBase = safeLineUrl(process.env.LINE_WEBHOOK_BASE_URL || new URL(request.url).origin);
  const endpoint = configuredBase ? new URL("/api/line/messaging/webhook", configuredBase).toString() : null;
  let webhook: { endpoint: string; active: boolean } | null = null;
  let webhookTested = false;
  if (endpoint) {
    const registered = await fetch("https://api.line.me/v2/bot/channel/webhook/endpoint", {
      method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }), signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (registered?.ok) {
      const tested = await fetch("https://api.line.me/v2/bot/channel/webhook/test", {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }), signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      if (tested?.ok) {
        const result = await tested.json() as { success?: boolean };
        webhookTested = result.success === true;
      }
    }
  }
  webhook = await webhookStatus(accessToken);
  return noStore({ connected: true, channelId, loginChannelId, liffId, liff: Boolean(loginChannelId && liffId), source: "saved",
    bot: { displayName: bot.displayName, basicId: bot.basicId }, channelSecret: true, accessToken: true,
    membershipUrl: membershipUrl || "", webhook, webhookTested,
    server: { supabaseUrl: true, publishableKey: true, secretKey: true },
    message: webhookTested ? "เชื่อม LINE และทดสอบ Webhook สำเร็จ" : endpoint ? "เชื่อม LINE ได้แล้ว แต่ทดสอบ Webhook ยังไม่ผ่าน ตรวจ URL และเปิด Use webhook ใน LINE Developers" : "เชื่อม LINE ได้แล้ว ตั้งค่า URL HTTPS เพื่อรับข้อความจาก LINE" });
}
