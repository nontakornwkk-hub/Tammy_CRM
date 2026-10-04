import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminPrize } from "./types";
type CatalogSession={db:SupabaseClient;ownerId:string;catalogDb?:SupabaseClient;catalogOwnerId?:string};
const canonical=(value:unknown):string=>JSON.stringify(value,(_,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
// Verified development sessions have a separate database. Mirror the shop's current
// game configuration there; no production write, wallet credit or ticket grant occurs.
export async function syncTestGameCatalog(session:CatalogSession){
  const {db,ownerId,catalogDb,catalogOwnerId}=session;
  if(!catalogDb||!catalogOwnerId)return;
  if(db===catalogDb)throw new Error("ฐานทดสอบต้องแยกจากร้านจริง");
  const [sourceProgram,sourceGames,targetProgram,targetGames]=await Promise.all([
    catalogDb.from("game_programs").select("purchase_threshold,earning_enabled").eq("owner_id",catalogOwnerId).maybeSingle(),
    catalogDb.from("crm_games").select("game_key,engine,name,difficulty,enabled,version,prizes").eq("owner_id",catalogOwnerId),
    db.from("game_programs").select("purchase_threshold,earning_enabled").eq("owner_id",ownerId).maybeSingle(),
    db.from("crm_games").select("game_key,engine,name,difficulty,enabled,version,prizes").eq("owner_id",ownerId),
  ]);
  if([sourceProgram,sourceGames,targetProgram,targetGames].some(r=>r.error))throw new Error("โหลดการตั้งค่าเกมร้านสำหรับบัญชีทดสอบไม่สำเร็จ");
  const existing=new Map((targetGames.data||[]).map(g=>[g.game_key,g]));
  const rows=(sourceGames.data||[]).map(g=>({...g,prizes:(g.prizes as AdminPrize[]).map(p=>({...p,stock:p.stock===0?0:null}))}));
  const changed=rows.filter(g=>canonical(g)!==canonical(existing.get(g.game_key))).map(g=>({...g,owner_id:ownerId}));
  const keys=new Set(rows.map(g=>g.game_key));
  const stale=(targetGames.data||[]).filter(g=>g.enabled&&!keys.has(g.game_key)).map(g=>g.game_key);
  const writes=[];
  if(sourceProgram.data&&canonical(sourceProgram.data)!==canonical(targetProgram.data))writes.push(db.from("game_programs").upsert({...sourceProgram.data,owner_id:ownerId},{onConflict:"owner_id"}));
  if(changed.length)writes.push(db.from("crm_games").upsert(changed,{onConflict:"owner_id,game_key"}));
  if(stale.length)writes.push(db.from("crm_games").update({enabled:false}).eq("owner_id",ownerId).in("game_key",stale));
  const results=await Promise.all(writes);
  if(results.some(r=>r.error))throw new Error("อัปเดตเกมบัญชีทดสอบไม่สำเร็จ");
}
