import {crmActor,noStore,serviceDb} from "@/lib/line/server";
import {historyRange} from "@/lib/points-history-range";
import {historyCsvHeader,historyCsvRow,type HistoryExportRow} from "@/lib/points-history-csv";
export const runtime="nodejs";
async function authorized(request:Request){const actor=await crmActor(request);if(!actor||actor.role!=="owner")return null;const db=serviceDb();return db?{actor,db}:null;}
export async function GET(request:Request){
 const access=await authorized(request);if(!access)return noStore({error:"เฉพาะเจ้าของร้านที่เข้าสู่ระบบเท่านั้น"},403);
 const url=new URL(request.url),range=historyRange(Object.fromEntries(url.searchParams));
 if(!range)return noStore({error:"เลือกวันที่เริ่มต้นและสิ้นสุดให้ถูกต้อง ไม่เกินวันนี้"},400);
 const {actor,db}=access;
 const filter=()=>db.from("points_transactions").select("id",{count:"exact",head:true}).eq("owner_id",actor.ownerId).gte("created_at",range.fromInstant).lt("created_at",range.toInstant).lte("created_at",range.snapshot);
 if(url.searchParams.get("download")!=="1"){
  const redemption=()=>db.from("redemptions").select("id",{count:"exact",head:true}).eq("owner_id",actor.ownerId).gte("redeemed_at",range.fromInstant).lt("redeemed_at",range.toInstant).lte("redeemed_at",range.snapshot);
  const [all,coupons,rewards,games,audit]=await Promise.all([filter(),redemption().not("coupon_id","is",null),redemption().is("coupon_id",null),db.from("game_plays").select("id",{count:"exact",head:true}).eq("owner_id",actor.ownerId).gte("created_at",range.fromInstant).lt("created_at",range.toInstant).lte("created_at",range.snapshot),db.from("audit_logs").select("id",{count:"exact",head:true}).eq("owner_id",actor.ownerId).gte("created_at",range.fromInstant).lt("created_at",range.toInstant).lte("created_at",range.snapshot)]);
  if([all,coupons,rewards,games,audit].some(result=>result.error))return noStore({error:"นับรายการไม่สำเร็จ"},500);
  const others=(coupons.count||0)+(rewards.count||0)+(games.count||0);
  return noStore({from:range.from,to:range.to,snapshot:range.snapshot,count:(all.count||0)+others+(audit.count||0),total:(all.count||0)+others+(audit.count||0),preserved:0,counts:{points:all.count||0,coupons:coupons.count||0,rewards:rewards.count||0,games:games.count||0,audit:audit.count||0}});
 }
 let cursor:{history_key:string;created_at:string}|null=null,started=false,exportedCount=0;const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({async pull(controller){
  if(!started){controller.enqueue(encoder.encode("\uFEFF"+historyCsvHeader+"\r\n"));started=true;}
  const result=await db.rpc("transaction_history_rows",{p_owner_id:actor.ownerId,p_from:range.fromInstant,p_to:range.toInstant,p_snapshot:range.snapshot,p_after_time:cursor?.created_at||null,p_after_key:cursor?.history_key||null,p_limit:500});
  if(result.error){controller.error(new Error("ส่งออกประวัติไม่สำเร็จ"));return;}
  const rows=(result.data||[]) as unknown as HistoryExportRow[];
  if(rows.length){controller.enqueue(encoder.encode(rows.map((row,index)=>historyCsvRow(row,exportedCount+index+1)).join("\r\n")+"\r\n"));exportedCount+=rows.length;cursor=rows.at(-1)!;}
  if(rows.length<500){const recorded=await db.from("audit_logs").insert({owner_id:actor.ownerId,actor_id:actor.userId,action:"export_points_history",entity_type:"points_transactions",details:{from:range.from,to:range.to,count:exportedCount}});if(recorded.error){controller.error(new Error("บันทึกการสำรองไม่สำเร็จ"));return;}controller.close();}
 }});
 return new Response(stream,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="tammy-points-history-${range.from}-${range.to}.csv"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
export async function POST(request:Request){
 const access=await authorized(request);if(!access)return noStore({error:"เฉพาะเจ้าของร้านที่เข้าสู่ระบบเท่านั้น"},403);
 let input:Record<string,unknown>;try{input=await request.json();}catch{return noStore({error:"ข้อมูลไม่ถูกต้อง"},400);}
 if(!input||typeof input!=="object")return noStore({error:"ข้อมูลไม่ถูกต้อง"},400);
 const range=historyRange(input);
 if(!range||typeof input.snapshot!=="string"||input.confirmation!=="ล้างประวัติ"||!Number.isInteger(input.expectedCount)||Number(input.expectedCount)<1)return noStore({error:"กรุณาตรวจช่วงวันที่ จำนวนรายการ และคำยืนยัน"},400);
 const {actor,db}=access;
 const result=await db.rpc("clear_transaction_history_range",{p_owner_id:actor.ownerId,p_actor_id:actor.userId,p_from:range.fromInstant,p_to:range.toInstant,p_snapshot:range.snapshot,p_expected_count:input.expectedCount});
 if(result.error){if(result.error.message.includes("HISTORY_CHANGED"))return noStore({error:"รายการเปลี่ยนไป กรุณาตรวจจำนวนใหม่ก่อนล้าง"},409);if(result.error.message.includes("FORBIDDEN"))return noStore({error:"เฉพาะเจ้าของร้านเท่านั้น"},403);return noStore({error:"ล้างประวัติไม่สำเร็จ กรุณาลองใหม่"},500);}
 return noStore(result.data);
}
