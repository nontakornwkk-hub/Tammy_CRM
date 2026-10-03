import {crmActor,noStore,serviceDb} from "@/lib/line/server";
export async function GET(request:Request){
 const actor=await crmActor(request);if(!actor)return noStore({error:"กรุณาเข้าสู่ระบบ"},401);const db=serviceDb();if(!db)return noStore({error:"ฐานข้อมูลไม่พร้อม"},503);
 const params=new URL(request.url).searchParams;const start=params.get("start")||"",end=params.get("end")||start,kind=params.get("kind")||"all",before=params.get("before"),id=params.get("id");
 const dateValid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(`${value}T00:00:00+07:00`))&&new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
 if((start&&!dateValid(start))||(end&&!dateValid(end))||(start&&end<start)||!["all","points","coupon","item"].includes(kind)||(before&&(!/^\d{4}-\d{2}-\d{2}T/.test(before)||!Number.isFinite(Date.parse(before))||!id||!/^[0-9a-f-]{36}$/i.test(id))))return noStore({error:"ตัวกรองไม่ถูกต้อง"},400);
 let query=db.from("game_plays").select("id,member_id,game_key,prize,created_at,tickets_before,tickets_after,member:members(name,line_picture_url)").eq("owner_id",actor.ownerId).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(51);
 if(start)query=query.gte("created_at",`${start}T00:00:00+07:00`).lte("created_at",`${end}T23:59:59.999999+07:00`);if(kind!=="all")query=query.eq("prize->>kind",kind);if(before)query=query.or(`created_at.lt.${new Date(before).toISOString()},and(created_at.eq.${new Date(before).toISOString()},id.lt.${id})`);
 const result=await query;if(result.error)return noStore({error:"อ่านประวัติไม่สำเร็จ"},500);const rows=result.data||[];return noStore({plays:rows.slice(0,50),hasMore:rows.length>50});
}
