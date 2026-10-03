import { crmActor, noStore, serviceDb, safeLineUrl } from "@/lib/line/server";
export const runtime = "nodejs";
type Related = { id?:string; name?:string; member_code?:string; title?:string };
type Row = { id:string; member_id:string; reward_id:string|null; coupon_id:string|null; item_kind:"reward"|"coupon"; item_title:string; points_spent:number; status:string; redeemed_at:string; members:Related|Related[]|null; rewards:Related|Related[]|null; coupons:Related|Related[]|null };
const one = (value:Related|Related[]|null) => Array.isArray(value)?value[0]:value;
export async function GET(request:Request) {
  const actor=await crmActor(request);
  if(!actor||actor.role==="staff")return noStore({error:"ไม่มีสิทธิ์ดูประวัติการแลก"},403);
  const params=new URL(request.url).searchParams;
  const offset=Number(params.get("offset")||0),kind=params.get("kind")||"all";
  if(!Number.isSafeInteger(offset)||offset<0||offset>1_000_000||!["all","reward","coupon"].includes(kind))return noStore({error:"ตัวกรองไม่ถูกต้อง"},400);
  const db=serviceDb();if(!db)return noStore({error:"ฐานข้อมูลไม่พร้อมใช้งาน"},503);
  let query=db.from("redemptions").select("id,member_id,reward_id,coupon_id,item_kind,item_title,points_spent,status,redeemed_at,members!inner(id,name,member_code),rewards(title),coupons(title)").eq("owner_id",actor.ownerId).eq("members.owner_id",actor.ownerId);
  if(kind!=="all")query=query.eq("item_kind",kind);
  const result=await query.order("redeemed_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+50);
  if(result.error)return noStore({error:"โหลดประวัติไม่สำเร็จ กรุณาลองใหม่"},500);
  const rows=(result.data||[]) as unknown as Row[];
  const displayed=rows.slice(0,50),ids=[...new Set(displayed.map(row=>row.member_id))];
  const links=ids.length?await db.from("members").select("member_id:id,line_picture_url,line_display_name").eq("owner_id",actor.ownerId).in("id",ids):{data:[],error:null};
  if(links.error)return noStore({error:"โหลดโปรไฟล์สมาชิกไม่สำเร็จ กรุณาลองใหม่"},500);
  const profiles=new Map((links.data||[]).map(link=>[link.member_id,link]));
  return noStore({hasMore:rows.length>50,rows:displayed.map(row=>({id:row.id,kind:row.item_kind,title:row.item_title||one(row.reward_id?row.rewards:row.coupons)?.title||"รายการที่เก็บในประวัติ",points:row.points_spent,status:row.status,date:row.redeemed_at,member:{name:one(row.members)?.name||profiles.get(row.member_id)?.line_display_name||"สมาชิก",code:one(row.members)?.member_code||"",picture:safeLineUrl(profiles.get(row.member_id)?.line_picture_url)}}))});
}
