import "server-only";
import { getTestTickets } from "./test-tickets";
import type { SupabaseClient } from "@supabase/supabase-js";
import { defaultGameSetup, playablePrizes } from "./config";
import type { AdminPrize, GameDefinition, GameSetup, MemberGames } from "./types";
export const missingGameSchema = (code?: string) => ["42P01", "PGRST205", "PGRST202"].includes(code || "");
export async function readGameSetup(db: SupabaseClient, owner: string, key = "paw-wheel") {
  const [program, game] = await Promise.all([db.from("game_programs").select("*").eq("owner_id", owner).maybeSingle(), db.from("crm_games").select("*").eq("owner_id", owner).eq("game_key", key).maybeSingle()]);
  if ([program.error, game.error].some(error => error && !missingGameSchema(error.code))) throw new Error("อ่านการตั้งค่าเกมไม่สำเร็จ");
  const setup = defaultGameSetup();
  if (program.data) setup.program = { purchaseThreshold: Number(program.data.purchase_threshold), earningEnabled: program.data.earning_enabled };
  if (game.data) setup.game = { id: game.data.id, key: game.data.game_key, engine: game.data.engine, name: game.data.name, difficulty: game.data.difficulty, enabled: game.data.enabled, version: game.data.version, prizes: game.data.prizes as AdminPrize[] };
  return { ready: !program.error && !game.error, setup };
}
export async function readMemberGames(db: SupabaseClient, owner: string, member: string): Promise<MemberGames> {
  const [program, games, wallet, plays, grants] = await Promise.all([
    db.from("game_programs").select("purchase_threshold,earning_enabled").eq("owner_id", owner).maybeSingle(),
    db.from("crm_games").select("id,game_key,engine,name,difficulty,enabled,version,prizes").eq("owner_id", owner).eq("enabled", true).order("game_key"),
    db.from("game_wallets").select("balance,carry").eq("owner_id", owner).eq("member_id", member).maybeSingle(),
    db.from("game_plays").select("id,game_key,prize,created_at,tickets_before,tickets_after,points_after").eq("owner_id", owner).eq("member_id", member).order("created_at", { ascending: false }).order("id").limit(100),
    db.from("game_grants").select("id,play_id,title,kind,status,expires_at,qr_token,snapshot,created_at").eq("owner_id", owner).eq("member_id", member).order("created_at", { ascending: false }).order("id").limit(100),
  ]);
  const errors = [program.error, games.error, wallet.error, plays.error, grants.error].filter(Boolean);
  if (errors.some(error => !missingGameSchema(error?.code))) throw new Error("อ่านเกมหรือสิทธิ์ไม่สำเร็จ");
  const test=getTestTickets(owner,member);let testBalance=0;if(test&&!errors.length){const used=await db.from("game_plays").select("id",{count:"exact",head:true}).eq("owner_id",owner).eq("member_id",member).eq("test_batch_id",test.id);if(used.error)throw new Error("อ่านสิทธิ์ทดสอบไม่สำเร็จ");testBalance=Math.max(0,test.limit-(used.count||0));}
  // Only this allowlisted structure crosses the member boundary. Odds and stock
  // are stored service-only, never included in member HTML/API payloads.
  return { ready: !errors.length, program: { purchaseThreshold: Number(program.data?.purchase_threshold || 500), earningEnabled: program.data?.earning_enabled || false }, games: (games.data || []).map(game => ({ id: game.id, key: game.game_key, engine: game.engine, name: game.name, difficulty: game.difficulty, enabled: game.enabled, version: game.version, prizes: playablePrizes(game.prizes as AdminPrize[]) })) as GameDefinition[], wallet: { testBalance, balance: Number(wallet.data?.balance || 0), carry: Number(wallet.data?.carry || 0) }, plays: plays.data || [], grants: grants.data || [] };
}
export const gameErrorMessages: Record<string, string> = { HISTORY_CLEARED: "ประวัติรอบนี้ถูกล้างแล้ว กรุณาเริ่มรอบใหม่", MIN_SPEND: "ยอดซื้อยังไม่ถึงเงื่อนไขคูปอง", NO_TICKETS: "สิทธิ์ไม่เพียงพอ สะสมยอดซื้อเพื่อรับสิทธิ์เพิ่ม", GAME_UNAVAILABLE: "เกมนี้พักให้บริการอยู่", CONFIG_CHANGED: "การตั้งค่าเกมเปลี่ยนแล้ว กรุณาโหลดข้อมูลล่าสุด", PRIZES_EXHAUSTED: "รางวัลหมดแล้ว ร้านกำลังเติมรางวัล", REQUEST_CONFLICT: "รหัสรอบนี้ถูกใช้กับเกมอื่นแล้ว", ALREADY_USED: "รางวัลนี้ใช้แล้ว", GRANT_EXPIRED: "รางวัลหมดอายุแล้ว", GRANT_NOT_FOUND: "ไม่พบรางวัล", MEMBER_NOT_FOUND: "สมาชิกไม่พร้อมใช้งาน", FORBIDDEN: "ไม่มีสิทธิ์ทำรายการ", INVALID_ODDS: "เปิดอย่างน้อยหนึ่งช่องที่มีเรทการออกมากกว่า 0", INVALID_CONFIG: "การตั้งค่าไม่ถูกต้อง" };
