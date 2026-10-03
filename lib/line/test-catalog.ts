import "server-only";
import type { MemberSession } from "./member-session";
/** Production access here is read-only. The replica and all redemption writes
 * remain in the separately authenticated development database. */
export async function prepareTestItem(session:MemberSession,kind:"reward"|"coupon",itemId:string) {
  if(!session.catalogDb||!session.catalogOwnerId)return null;
  const table=kind==="reward"?"rewards":"coupons";
  const columns=kind==="reward"?"id,title,description,category,points_cost,image_url,active,starts_at,ends_at,stock":"id,title,description,discount_type,discount_value,min_spend,theme_color,active,starts_at,ends_at,qr_valid_minutes,usage_limit,used_count";
  const result=await session.catalogDb.from(table).select(columns).eq("owner_id",session.catalogOwnerId).eq("id",itemId).eq("active",true).maybeSingle();
  if(result.error||!result.data)return "ITEM_UNAVAILABLE";
  const item=result.data as unknown as Record<string,unknown>;
  const now=Date.now();
  if(item.starts_at&&Date.parse(String(item.starts_at))>now||item.ends_at&&Date.parse(String(item.ends_at))<now)return "ITEM_UNAVAILABLE";
  if(kind==="reward"&&item.stock!==null&&Number(item.stock)<=0)return "OUT_OF_STOCK";
  if(kind==="coupon"&&item.usage_limit!==null&&Number(item.used_count)>=Number(item.usage_limit))return "LIMIT_REACHED";
  const {stock,usage_limit,used_count,...shared}=item;
  void stock;void usage_limit;void used_count;
  const copy:Record<string,unknown>=kind==="reward"?{...shared,owner_id:session.ownerId,stock:null}:{...shared,owner_id:session.ownerId,code:`TEST-${itemId}`,audience_mode:"public",usage_limit:null};
  const mirrored=await session.db.from(table).upsert(copy,{onConflict:"id"});
  return mirrored.error?"TEST_CATALOG_UNAVAILABLE":null;
}
