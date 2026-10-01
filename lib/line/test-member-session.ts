import "server-only";
import { createClient } from "@supabase/supabase-js";
import { crmActor, serviceDb } from "./server";

export const testMemberMarker = "__tammy_admin_test_member__";

export function testServiceDb() {
  if (process.env.NODE_ENV !== "development") return null;
  const url = process.env.TEST_SUPABASE_URL;
  const key = process.env.TEST_SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function testAdminContext(token: string) {
  const db = testServiceDb();
  if (!db || !token) return null;
  const actor = await crmActor(new Request("http://localhost/test-member", { headers: { Authorization: `Bearer ${token}` } }));
  if (!actor || actor.role === "staff") return null;
  const production = serviceDb();
  if (!production) return null;
  const shop = await production.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").maybeSingle();
  if (!shop.data || shop.data.owner_id !== actor.ownerId) return null;
  const profile = await db.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").maybeSingle();
  if (!profile.data) return null;
  return { db, ownerId: profile.data.owner_id as string };
}
