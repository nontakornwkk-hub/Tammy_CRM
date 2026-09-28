import { createHmac, timingSafeEqual } from "node:crypto";
import { noStore, serviceDb } from "@/lib/line/server";

export const runtime = "nodejs";

type LineEvent = {
  type?: string; webhookEventId?: string;
  source?: { type?: string; userId?: string };
  message?: { id?: string; type?: string; text?: string };
};

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
    if (event.type === "unfollow") {
      await db.from("line_conversations").update({ blocked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("owner_id", result.data.owner_id).eq("line_user_id", subject);
      continue;
    }
    if (event.type !== "follow" && event.type !== "message") continue;
    const messageKey = event.message?.id || event.webhookEventId;
    if (!messageKey) continue;
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
    const kind = event.type === "follow" ? "other" :
      ["text", "image", "sticker", "file"].includes(event.message?.type || "") ? event.message!.type : "other";
    const body = event.type === "follow" ? "เริ่มติดตามบัญชีร้าน" :
      kind === "text" ? (event.message?.text || "").slice(0, 5000) :
      kind === "image" ? "ส่งรูปภาพ" : kind === "sticker" ? "ส่งสติกเกอร์" : kind === "file" ? "ส่งไฟล์" : "ส่งข้อความประเภทอื่น";
    const saved = await db.rpc("line_record_inbound", {
      store_owner: result.data.owner_id, subject, profile_name: name, profile_picture: picture,
      message_key: messageKey, message_kind: kind, message_body: body,
    });
    if (saved.error) {
      console.error("[line-webhook] save failed", { code: saved.error.code });
      return noStore({ error: "บันทึกแชตไม่สำเร็จ" }, 500);
    }
    if (name) await db.from("line_member_links").update({ line_display_name: name, line_picture_url: picture, profile_synced_at: new Date().toISOString() })
      .eq("owner_id", result.data.owner_id).eq("line_user_id", subject);
  }
  return noStore({ ok: true });
}
