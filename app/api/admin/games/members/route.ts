import { normalizeMemberScan } from "@/lib/member-code";
import { crmActor,noStore,serviceDb } from "@/lib/line/server";
export async function GET(request:Request){
 const actor=await crmActor(request);if(!actor)return noStore({error:"กรุณาเข้าสู่ระบบ"},401);if(actor.role!=="owner")return noStore({error:"เฉพาะเจ้าของร้านให้สิทธิ์ได้"},403);
 const db=serviceDb();if(!db)return noStore({error:"ฐานข้อมูลไม่พร้อม"},503);
 const code=normalizeMemberScan(new URL(request.url).searchParams.get("code")||"");
 const q=(new URL(request.url).searchParams.get("q")||"").slice(0,80).replace(/[%_,().*"\\]/g,"").trim();
 let query=db.from("members").select("id,name,member_code,phone,line_picture_url").eq("owner_id",actor.ownerId).eq("status","active").order("name").order("id").limit(code?1:q?20:3);
 if(code)query=query.or(`member_code.eq.${code},legacy_member_code.eq.${code},previous_member_code.eq.${code},former_member_code.eq.${code}`);
 else if(q)query=query.or(`name.ilike.%${q}%,member_code.ilike.%${q}%,phone.ilike.%${q}%`);
 const result=await query;if(result.error)return noStore({error:"ค้นหาสมาชิกไม่สำเร็จ"},500);return noStore({members:result.data});
}
