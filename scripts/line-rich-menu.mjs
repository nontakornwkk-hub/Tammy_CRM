import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());

const mode = process.argv[2] || "inspect";
if (!["inspect", "create", "activate"].includes(mode)) throw new Error("Use inspect, create, or activate");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Missing server-side Supabase configuration");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: shop, error: shopError } = await db.from("public_shop_profiles").select("owner_id").eq("slug", "tammy").single();
if (shopError || !shop) throw new Error("Tammy shop not found");
const { data: connection, error: connectionError } = await db.from("line_connections")
  .select("channel_id,access_token,liff_id,bot_display_name,bot_basic_id")
  .eq("owner_id", shop.owner_id).single();
if (connectionError || !connection?.access_token || !connection.liff_id) throw new Error("Messaging API or LIFF connection missing");
const token = connection.access_token;

async function lineRequest(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};
  if (!response.ok) throw new Error(`LINE API ${response.status}: ${JSON.stringify(data)}`);
  return data;
}

const bot = await lineRequest("https://api.line.me/v2/bot/info");
console.log(`LINE account: ${bot.displayName} (${bot.basicId})`);
console.log(`LIFF ID: ${connection.liff_id}`);
let current = null;
try {
  current = await lineRequest("https://api.line.me/v2/bot/user/all/richmenu");
  console.log(`Current default Rich Menu: ${current.richMenuId}`);
} catch (error) {
  if (!String(error).includes("LINE API 404:")) throw error;
  console.log("Current default Rich Menu: none");
}
if (mode === "inspect") process.exit(0);

const root = `https://liff.line.me/${connection.liff_id}`;
const name = "Tammy Membership 4-button v1";
const menu = {
  size: { width: 1526, height: 1030 },
  selected: true,
  name,
  chatBarText: "เมนูสมาชิก",
  areas: [
    { bounds: { x: 0, y: 0, width: 1526, height: 542 }, action: { type: "uri", label: "MEMBERSHIP", uri: root } },
    { bounds: { x: 0, y: 542, width: 509, height: 488 }, action: { type: "uri", label: "เช็กแต้ม", uri: `${root}/?view=points` } },
    { bounds: { x: 509, y: 542, width: 509, height: 488 }, action: { type: "uri", label: "ของรางวัล", uri: `${root}/?view=rewards` } },
    { bounds: { x: 1018, y: 542, width: 508, height: 488 }, action: { type: "uri", label: "ข่าวสาร", uri: `${root}/?view=news` } },
  ],
};

if (mode === "create") {
  const imagePath = path.resolve("public/assets/line-rich-menu-v1.jpg");
  const imageInfo = await stat(imagePath);
  if (imageInfo.size > 1_000_000) throw new Error("Rich Menu image exceeds LINE's 1 MB limit");
  await lineRequest("https://api.line.me/v2/bot/richmenu/validate", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(menu),
  });
  const created = await lineRequest("https://api.line.me/v2/bot/richmenu", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(menu),
  });
  console.log(`Created Rich Menu draft: ${created.richMenuId}`);
  await lineRequest(`https://api-data.line.me/v2/bot/richmenu/${created.richMenuId}/content`, {
    method: "POST", headers: { "Content-Type": "image/jpeg" }, body: await readFile(imagePath),
  });
  console.log(`Uploaded approved image: ${imageInfo.size} bytes`);
  console.log("Not activated; run activate <richMenuId> after confirming LIFF Endpoint points to /customer.");
}

if (mode === "activate") {
  const id = process.argv[3];
  if (!/^richmenu-[a-f0-9]+$/i.test(id || "")) throw new Error("Pass a valid Rich Menu ID");
  const draft = await lineRequest(`https://api.line.me/v2/bot/richmenu/${id}`);
  if (draft.name !== name) throw new Error("Rich Menu ID does not match the approved Tammy design");
  await lineRequest(`https://api.line.me/v2/bot/user/all/richmenu/${id}`, { method: "POST" });
  const active = await lineRequest("https://api.line.me/v2/bot/user/all/richmenu");
  if (active.richMenuId !== id) throw new Error("LINE did not confirm the default Rich Menu");
  console.log(`Active default Rich Menu: ${id}`);
}
