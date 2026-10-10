import { readMemberCatalog } from "@/lib/line/member-catalog";
import { verifiedMemberSession } from "@/lib/line/member-session";

export const runtime = "nodejs";

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  let input: { idToken?: string; accessToken?: string };
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: "ข้อมูลมีขนาดใหญ่เกินไป" }, 413);
    input = JSON.parse(raw);
  } catch { return json({ error: "คำขอไม่ถูกต้อง" }, 400); }
  const session = await verifiedMemberSession(input);
  if ("error" in session) return json({ error: session.error }, session.status);
  return readMemberCatalog(session);
}
