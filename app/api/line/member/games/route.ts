import { syncTestGameCatalog } from "@/lib/games/test-catalog";
import { getTestTickets } from "@/lib/games/test-tickets";
import { randomInt } from "node:crypto";
import { verifiedMemberSession } from "@/lib/line/member-session";
import { noStore } from "@/lib/line/server";
import { gameErrorMessages, missingGameSchema, readMemberGames } from "@/lib/games/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  let input;
  try { const raw = await request.text(); if (raw.length > 16384) return noStore({ error: "ข้อมูลยาวเกินไป" }, 413); input = JSON.parse(raw); } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  if (!input || typeof input !== "object" || !["status", "play", "recover"].includes(input.action) || (input.idToken != null && typeof input.idToken !== "string") || (input.accessToken != null && typeof input.accessToken !== "string")) return noStore({ error: "คำขอไม่ถูกต้อง" }, 400);
  const session = await verifiedMemberSession(input); if ("error" in session) return noStore({ error: session.error }, session.status);
  try {
    if(input.action!=="recover")await syncTestGameCatalog(session);
    if (input.action === "status") return noStore(await readMemberGames(session.db, session.ownerId, session.memberId));
    if (typeof input.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input.requestId) || typeof input.gameKey !== "string" || !/^[a-z][a-z0-9-]{2,49}$/.test(input.gameKey)) return noStore({ error: "รหัสรอบไม่ถูกต้อง" }, 400);
    if (input.action === "recover") {
      const result = await session.db.from("game_plays").select("id,game_key,prize,slots,tickets_before,tickets_after,points_after,created_at").eq("owner_id", session.ownerId).eq("member_id", session.memberId).eq("request_id", input.requestId).eq("game_key", input.gameKey).maybeSingle();
      if (result.error) throw new Error("ตรวจรอบเดิมไม่สำเร็จ");
      return noStore({ play: result.data });
    }
    if (!Number.isInteger(input.version) || input.version < 1) return noStore({ error: "เกมยังไม่พร้อมรับรางวัลจริง" }, 409);
    const batch=getTestTickets(session.ownerId,session.memberId);let testing=false;if(batch){const used=await session.db.from("game_plays").select("id",{count:"exact",head:true}).eq("owner_id",session.ownerId).eq("member_id",session.memberId).eq("test_batch_id",batch.id);if(used.error)throw new Error("ตรวจสิทธิ์ทดสอบไม่สำเร็จ");testing=(used.count||0)<batch.limit;}
    const args={p_owner:session.ownerId,p_member:session.memberId,p_key:input.gameKey,p_request:input.requestId,p_version:input.version,p_draw:randomInt(1000000000)};
    const result=testing&&batch?await session.db.rpc("play_crm_game_test",{...args,p_batch:batch.id,p_limit:batch.limit}):await session.db.rpc("play_crm_game",args);
    if (result.error) return noStore({ error: missingGameSchema(result.error.code) ? "รอเปิดใช้ฐานข้อมูลเกม" : gameErrorMessages[result.error.message] || "ทำรายการไม่สำเร็จ กรุณาตรวจรอบเดิม", code: result.error.message }, missingGameSchema(result.error.code) || gameErrorMessages[result.error.message] ? 409 : 500);
    return noStore({ play: result.data });
  } catch (error) { return noStore({ error: (error as Error).message }, 500); }
}
