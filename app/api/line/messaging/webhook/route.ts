import { createHmac, timingSafeEqual } from "node:crypto";
import { noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

type LineEvent = {
  type?: string; webhookEventId?: string; replyToken?: string;
  source?: { type?: string; userId?: string };
  message?: { id?: string; type?: string; text?: string };
  postback?: { data?: string };
};

function isPointsRequest(event: LineEvent) {
  if (event.type === "postback") return new URLSearchParams(event.postback?.data || "").get("action") === "check_points";
  return event.type === "message" && event.message?.type === "text" &&
    /^(เช็กแต้ม|เช็คแต้ม|ตรวจสอบแต้ม|เช็กคะแนน|เช็คคะแนน)$/u.test(event.message.text?.trim() || "");
}

async function replyPoints(db: NonNullable<ReturnType<typeof serviceDb>>, ownerId: string, subject: string, replyToken: string, accessToken: string) {
  const link = await db.from("members").select("name,points,level,status")
    .eq("owner_id", ownerId).eq("line_user_id", subject).maybeSingle();
  if (link.error) throw link.error;
  let message: Record<string, unknown> = { type: "text", text: "ไม่พบข้อมูลสมาชิก กรุณาเชื่อมบัญชีสมาชิกก่อน" };
  if (link.data) {
    const member = link;
    if (member.data?.status === "active") {
      const points = Number(member.data.points || 0).toLocaleString("th-TH");
      const name = String(member.data.name || "สมาชิก").trim().replace(/^คุณ\s*/u, "").slice(0, 80);
      message = {
        type: "flex", altText: `Tammy Pet Shop · คุณ ${name} · ${points} แต้ม`,
        contents: {
          type: "bubble", size: "kilo",
          header: {
            type: "box", layout: "horizontal", justifyContent: "center", alignItems: "center",
            backgroundColor: "#A9886D", paddingAll: "12px", spacing: "sm", contents: [
              { type: "text", text: "Tammy Pet Shop", weight: "bold", size: "md", color: "#FFFFFF", flex: 0 },
              { type: "text", text: "🐾", size: "sm", flex: 0 },
            ],
          },
          body: {
            type: "box", layout: "vertical", backgroundColor: "#FFFDF8",
            paddingAll: "16px", spacing: "md", contents: [
              { type: "separator", color: "#DCC8B2" },
              { type: "text", text: `คุณ ${name}`, weight: "bold", size: "md", color: "#4A352B", align: "center", wrap: true },
              { type: "box", layout: "vertical", backgroundColor: "#F4E8D9", cornerRadius: "20px", paddingAll: "12px", contents: [
                { type: "text", text: `⭐ ${points} แต้ม`, weight: "bold", size: "xl", color: "#4A352B", align: "center", wrap: true },
              ] },
              { type: "text", text: "คะแนนสะสมของคุณ", size: "xs", color: "#907A6B", align: "center" },
            ],
          },
        },
      };
    } else if (member.data) message = { type: "text", text: "บัญชีสมาชิกนี้ยังไม่พร้อมใช้งาน กรุณาติดต่อร้าน Tammy Petshop" };
  }
  const response = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ replyToken, messages: [message] }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) console.error("[line-webhook] points reply failed", { status: response.status });
}

function verified(raw: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(raw, "utf8").digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  const db = serviceDb();
  if (!db) return noStore({ error: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า SUPABASE_SECRET_KEY" }, 503);
  const raw = await request.text();
  if (raw.length > 1_000_000) return noStore({ error: "Payload ใหญ่เกินไป" }, 413);
  let payload: { destination?: string; events?: LineEvent[] };
  try { payload = JSON.parse(raw) as { destination?: string; events?: LineEvent[] }; }
  catch { return noStore({ error: "JSON ไม่ถูกต้อง" }, 400); }
  if (!payload.destination || !/^U[0-9a-f]{32}$/.test(payload.destination)) return noStore({ error: "ไม่พบ LINE channel" }, 400);
  const result = await db.from("line_connections").select("owner_id,channel_secret,access_token")
    .eq("bot_user_id", payload.destination).maybeSingle();
  if (result.error || !result.data) return noStore({ error: "ยังไม่ได้เชื่อม LINE channel นี้" }, 503);
  if (!verified(raw, request.headers.get("x-line-signature") || "", result.data.channel_secret))
    return noStore({ error: "ลายเซ็น LINE ไม่ถูกต้อง" }, 401);
  if (!Array.isArray(payload.events)) return noStore({ error: "รายการเหตุการณ์ไม่ถูกต้อง" }, 400);

  for (const event of payload.events) {
    const subject = event.source?.type === "user" ? event.source.userId : null;
    if (!subject || !/^U[0-9a-f]{32}$/.test(subject)) continue;
    if (event.type === "postback") {
      if (isPointsRequest(event) && event.replyToken) {
        try { await replyPoints(db, result.data.owner_id, subject, event.replyToken, result.data.access_token); }
        catch (error) { console.error("[line-webhook] points lookup failed", error); return noStore({ error: "ตรวจสอบแต้มไม่สำเร็จ" }, 500); }
      }
      continue;
    }
    if (event.type === "unfollow") {
      continue;
    }
    if (event.type !== "follow" && event.type !== "message") continue;
    let name: string | null = null;
    let picture: string | null = null;
    try {
      const profile = await fetch(`https://api.line.me/v2/bot/profile/${subject}`, {
        headers: { Authorization: `Bearer ${result.data.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(5000),
      });
      if (profile.ok) {
        const data = await profile.json() as { displayName?: string; pictureUrl?: string };
        name = data.displayName?.slice(0, 120) || null;
        picture = data.pictureUrl?.startsWith("https://") ? data.pictureUrl : null;
      }
    } catch { /* A message remains readable even if LINE profile is unavailable. */ }
    if (name) await db.from("members").update({ line_display_name: name, line_picture_url: picture, line_profile_synced_at: new Date().toISOString() })
      .eq("owner_id", result.data.owner_id).eq("line_user_id", subject);
    if (isPointsRequest(event) && event.replyToken) {
      try { await replyPoints(db, result.data.owner_id, subject, event.replyToken, result.data.access_token); }
      catch (error) { console.error("[line-webhook] points lookup failed", error); return noStore({ error: "ตรวจสอบแต้มไม่สำเร็จ" }, 500); }
    }
  }
  return noStore({ ok: true });
}
