import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

nextEnv.loadEnvConfig(process.cwd());

const productionUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const productionKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const testUrl = process.env.TEST_SUPABASE_URL;
const testKey = process.env.TEST_SUPABASE_SECRET_KEY;
if (!productionUrl || !productionKey || !testUrl || !testKey) throw new Error("Production or test Supabase server configuration is missing");
if (productionUrl === testUrl) throw new Error("Test and production databases must be different projects");

const production = createClient(productionUrl, productionKey, { auth: { persistSession: false } });
const test = createClient(testUrl, testKey, { auth: { persistSession: false } });

async function rows(client, table, query) {
  const result = await query(client.from(table));
  if (result.error) throw result.error;
  return result.data;
}

const shop = await rows(production, "public_shop_profiles", query => query.select("owner_id,shop_name,shop_name_en,description,welcome_message,logo_url,contacts,store_hours_enabled,weekly_hours,temporary_closure").eq("slug", "tammy").single());
let testShop = await rows(test, "public_shop_profiles", query => query.select("owner_id").eq("slug", "tammy").maybeSingle());
if (!testShop) {
  const account = await test.auth.admin.createUser({
    email: "tammy-test-owner@example.com",
    password: randomBytes(32).toString("hex"),
    email_confirm: true,
  });
  if (account.error || !account.data.user) throw account.error || new Error("Could not create test database owner");
  const ownerId = account.data.user.id;
  const settings = await rows(production, "store_settings", query => query.select("shop_name,shop_name_en,description,welcome_message,points_spend,points_earned,promotion_multiplier,point_expiry_months,opening_time,closing_time,extra").eq("owner_id", shop.owner_id).single());
  const store = await test.from("store_settings").insert({ ...settings, owner_id: ownerId });
  if (store.error) throw store.error;
  const profile = await test.from("public_shop_profiles").insert({ ...shop, slug: "tammy", owner_id: ownerId });
  if (profile.error) throw profile.error;
  testShop = { owner_id: ownerId };
}

for (const table of ["members", "pets", "points_transactions", "rewards", "coupons", "news", "contact_channels"]) {
  const result = await test.from(table).update({ owner_id: testShop.owner_id }).is("owner_id", null);
  if (result.error) throw result.error;
}

if (process.argv.includes("--bootstrap-only")) {
  process.stdout.write("Test owner and starter data are ready.\n");
  process.exit(0);
}

for (const [table, fields] of [
  ["rewards", "id,title,description,category,points_cost,stock,image_url,active,starts_at,ends_at"],
  ["coupons", "id,code,title,description,discount_type,discount_value,min_spend,usage_limit,used_count,active,starts_at,ends_at,theme_color,audience_mode,qr_valid_minutes"],
]) {
  const source = await rows(production, table, query => query.select(fields).eq("owner_id", shop.owner_id));
  if (!source.length) continue;
  const payload = source.map(row => ({ ...row, owner_id: testShop.owner_id }));
  const result = await test.from(table).upsert(payload, { onConflict: "id" });
  if (result.error) throw result.error;
  process.stdout.write(`Seeded ${source.length} ${table} in the test database.\n`);
  if (process.argv.includes("--prune-starter-catalog")) {
    const existing = await rows(test, table, query => query.select("id").eq("owner_id", testShop.owner_id));
    const sourceIds = new Set(source.map(row => row.id));
    const extras = existing.filter(row => !sourceIds.has(row.id)).map(row => row.id);
    if (extras.length) {
      const relation = table === "rewards" ? "reward_id" : "coupon_id";
      if (table === "coupons") {
        const claims = await test.from("member_coupon_claims").delete().eq("owner_id", testShop.owner_id).in("coupon_id", extras);
        if (claims.error) throw claims.error;
      }
      const redemptions = await test.from("redemptions").delete().eq("owner_id", testShop.owner_id).in(relation, extras);
      if (redemptions.error) throw redemptions.error;
      const removed = await test.from(table).delete().eq("owner_id", testShop.owner_id).in("id", extras);
      if (removed.error) throw removed.error;
      process.stdout.write(`Removed ${extras.length} starter ${table} from the test database.\n`);
    }
  }
}

process.stdout.write("Test project is ready. No customer records or LINE credentials were copied.\n");
