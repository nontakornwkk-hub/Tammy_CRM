import { giveTestTickets } from "@/lib/games/test-tickets";
import { randomUUID } from "node:crypto";
import { crmActor, noStore, serviceDb } from "@/lib/line/server";
import { publicPrize, validateSetup } from "@/lib/games/config";
import type { AdminPrize } from "@/lib/games/types";
import { gameErrorMessages, missingGameSchema, readGameSetup } from "@/lib/games/server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const actor = await crmActor(request);
  if (!actor) return noStore({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  const db = serviceDb(); if (!db) return noStore({ error: "ฐานข้อมูลไม่พร้อม" }, 503);
  try {
    const config = await readGameSetup(db, actor.ownerId, new URL(request.url).searchParams.get("game") || "paw-wheel");
    const [plays, grants] = config.ready ? await Promise.all([
      db.from("game_plays").select("id,member_id,game_key,prize,created_at,tickets_before,tickets_after").eq("owner_id", actor.ownerId).order("created_at", { ascending: false }).order("id").limit(100),
      db.from("game_grants").select("id,title,kind,status,expires_at,created_at,member_id").eq("owner_id", actor.ownerId).order("created_at", { ascending: false }).order("id").limit(100),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    if (plays.error || grants.error) throw new Error("อ่านประวัติไม่สำเร็จ");
    const ids = [...new Set([...(plays.data || []).map(p => p.member_id), ...(grants.data || []).map(g => g.member_id)])];
    const members = ids.length ? await db.from("members").select("id,name,line_picture_url").eq("owner_id", actor.ownerId).in("id", ids) : { data: [], error: null };
    if (members.error) throw new Error("อ่านสมาชิกไม่สำเร็จ");
    const choices = config.ready ? await db.from("crm_games").select("game_key,name,engine,enabled,version").eq("owner_id", actor.ownerId).order("game_key") : { data: [], error: null };
    if (choices.error) throw new Error("อ่านรายชื่อเกมไม่สำเร็จ");
    // Staff can inspect/claim rewards but cannot read hidden prize weights.
    return noStore({ ...config, setup: actor.role === "staff" ? null : config.setup, canEdit: actor.role === "owner", choices: choices.data, plays: plays.data, grants: grants.data, members: members.data });
  } catch (error) { return noStore({ error: (error as Error).message }, 500); }
}
export async function POST(request: Request) {
  const actor = await crmActor(request); if (!actor) return noStore({ error: "กรุณาเข้าสู่ระบบ" }, 401);
  const db = serviceDb(); if (!db) return noStore({ error: "ฐานข้อมูลไม่พร้อม" }, 503);
  let input;
  try { const raw = await request.text(); if (raw.length > 5000000) return noStore({ error: "รูปภาพรวมใหญ่เกินไป" }, 413); input = JSON.parse(raw); } catch { return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400); }
  if (!input || typeof input !== "object") return noStore({ error: "ข้อมูลไม่ถูกต้อง" }, 400);
  if (input.action === "inspect" || input.action === "redeem") {
    const token = typeof input.token === "string" ? input.token.replace(/^TAMMY-GAME:/, "").trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(token)) return noStore({ error: "รหัสรางวัลไม่ถูกต้อง" }, 400);
    if (input.action === "inspect") {
      const grant = await db.from("game_grants").select("id,title,kind,status,expires_at,snapshot,member_id").eq("owner_id", actor.ownerId).eq("qr_token", token).maybeSingle();
      if (grant.error) return noStore({ error: "อ่านรางวัลไม่สำเร็จ" }, 500);
      if (!grant.data) return noStore({ error: "ไม่พบรางวัล" }, 404);
      const member = await db.from("members").select("name,line_picture_url").eq("id", grant.data.member_id).eq("owner_id", actor.ownerId).maybeSingle();
      return noStore({ grant: grant.data, member: member.data });
    }
    if (input.saleAmount != null && (!Number.isFinite(input.saleAmount) || input.saleAmount < 0 || input.saleAmount > 10000000)) return noStore({ error: "ยอดซื้อไม่ถูกต้อง" }, 400);
    const result = await db.rpc("redeem_game_grant", { p_owner: actor.ownerId, p_actor: actor.userId, p_token: token, p_sale: input.saleAmount ?? null });
    return result.error ? noStore({ error: gameErrorMessages[result.error.message] || "ยืนยันรางวัลไม่สำเร็จ" }, 409) : noStore({ result: result.data });
  }
  if (actor.role !== "owner") return noStore({ error: "เฉพาะเจ้าของร้านตั้งค่าเกมได้" }, 403);
  if(input.action === "program") {
    const p=input.program,expected=input.expected;
    if(!p||!expected||!Number.isFinite(p.purchaseThreshold)||p.purchaseThreshold<1||p.purchaseThreshold>1000000||typeof p.earningEnabled!=="boolean"||!Number.isFinite(expected.purchaseThreshold)||typeof expected.earningEnabled!=="boolean")return noStore({error:"ยอดซื้อหรือสถานะไม่ถูกต้อง"},400);
    const result=await db.rpc("save_game_program",{p_owner:actor.ownerId,p_actor:actor.userId,p_threshold:p.purchaseThreshold,p_enabled:p.earningEnabled,p_expected_threshold:expected.purchaseThreshold,p_expected_enabled:expected.earningEnabled});
    if(result.error)return noStore({error:missingGameSchema(result.error.code)?"ต้องเปิดใช้ฐานข้อมูลเกมก่อน":gameErrorMessages[result.error.message]||"บันทึกยอดซื้อไม่สำเร็จ"},409);
    return noStore({program:result.data});
  }
  if(input.action === "tickets") {
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if(typeof input.memberId!=="string"||!uuid.test(input.memberId)||typeof input.requestId!=="string"||!uuid.test(input.requestId)||!Number.isInteger(input.amount)||input.amount<1||input.amount>10000||typeof input.note!=="string"||input.note.length>200)return noStore({error:"เลือกสมาชิกและจำนวนสิทธิ์ 1–10,000 ครั้ง"},400);
    const member=await db.from("members").select("id").eq("owner_id",actor.ownerId).eq("id",input.memberId).eq("status","active").maybeSingle();if(member.error||!member.data)return noStore({error:"ไม่พบสมาชิกของร้าน"},404);
    try{const batch=giveTestTickets(actor.ownerId,input.memberId,input.requestId,input.amount);const used=await db.from("game_plays").select("id",{count:"exact",head:true}).eq("owner_id",actor.ownerId).eq("member_id",input.memberId).eq("test_batch_id",batch.id);if(used.error)return noStore({error:"ตรวจสิทธิ์ทดสอบไม่สำเร็จ"},500);return noStore({result:{id:batch.id,balance:Math.max(0,batch.limit-(used.count||0)),amount:input.amount,temporary:true}});}catch(e){return noStore({error:(e as Error).message},409);}
  }
  if(input.action === "toggle") {
    if(typeof input.enabled !== "boolean" || typeof input.gameKey !== "string" || !/^[a-z][a-z0-9-]{2,49}$/.test(input.gameKey) || !Number.isInteger(input.version) || input.version<1) return noStore({error:"ข้อมูลสถานะเกมไม่ถูกต้อง"},400);
    const toggled=await db.rpc("toggle_crm_game",{p_owner:actor.ownerId,p_actor:actor.userId,p_key:input.gameKey,p_version:input.version,p_enabled:input.enabled});
    if(toggled.error)return noStore({error:missingGameSchema(toggled.error.code)?"ต้องเปิดใช้ฐานข้อมูลเกมก่อน":gameErrorMessages[toggled.error.message]||"เปลี่ยนสถานะไม่สำเร็จ"},409);
    return noStore({game:toggled.data});
  }
  try { validateSetup(input.setup); } catch (error) { return noStore({ error: (error as Error).message }, 400); }
  input.setup.game.prizes = input.setup.game.prizes.map((p: AdminPrize) => ({ ...publicPrize(p), weight: p.weight, stock: p.stock, active: p.active, id: /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(p.id) ? p.id : randomUUID() }));
  const result = await db.rpc("save_crm_game", { p_owner: actor.ownerId, p_actor: actor.userId, p_setup: input.setup });
  if (result.error) return noStore({ error: missingGameSchema(result.error.code) ? "รอเปิดใช้ฐานข้อมูลเกม" : gameErrorMessages[result.error.message] || "บันทึกเกมไม่สำเร็จ" }, 409);
  return noStore({ result: result.data, ...await readGameSetup(db, actor.ownerId, input.setup.game.key) });
}
