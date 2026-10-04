import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { singleFlight } from "../single-flight";
type ShopContext={ownerId:string;channelId:string;liffId:string|null};
const pending=singleFlight<ShopContext>();
// Share only concurrent configuration reads across login and bootstrap requests.
// Settled configuration and authorization are not cached.
export function memberShopContext(db:SupabaseClient){return pending("tammy",async()=>{
 const shop=await db.from("public_shop_profiles").select("owner_id").eq("slug","tammy").single();
 if(shop.error||!shop.data)throw new Error("ไม่พบข้อมูลร้าน");
 const connection=await db.from("line_connections").select("login_channel_id,liff_id").eq("owner_id",shop.data.owner_id).maybeSingle();
 if(connection.error)throw new Error("ตรวจการเชื่อมต่อ LINE ไม่สำเร็จ");
 const channelId=connection.data?.login_channel_id||process.env.LINE_LOGIN_CHANNEL_ID;
 if(!channelId)throw new Error("ยังไม่เปิดใช้งาน LINE Login");
 return {ownerId:String(shop.data.owner_id),channelId,liffId:connection.data?.liff_id||process.env.NEXT_PUBLIC_LINE_LIFF_ID||null};
});}
