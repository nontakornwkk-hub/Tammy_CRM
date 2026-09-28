import { createClient } from "@supabase/supabase-js";

export type CrmActor = { userId: string; ownerId: string; role: "owner" | "manager" | "staff" };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;

export function serviceDb() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function crmActor(request: Request): Promise<CrmActor | null> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!token || !url || !key) return null;
  const db = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const identity = await db.auth.getUser(token);
  if (identity.error || !identity.data.user?.email_confirmed_at) return null;
  const access = await db.rpc("crm_current_access").maybeSingle();
  const account = access.data as { owner_id?: string; role?: string } | null;
  if (access.error || !account?.owner_id || !["owner", "manager", "staff"].includes(account.role || "")) return null;
  return { userId: identity.data.user.id, ownerId: account.owner_id, role: account.role as CrmActor["role"] };
}

export async function lineConnection(db: NonNullable<ReturnType<typeof serviceDb>>, ownerId: string) {
  const result = await db.from("line_connections").select("*").eq("owner_id", ownerId).maybeSingle();
  if (result.error) throw result.error;
  return result.data as null | {
    owner_id: string; channel_id: string; channel_secret: string; access_token: string;
    bot_user_id: string; bot_display_name: string; bot_basic_id: string; membership_url: string | null;
    login_channel_id: string | null; liff_id: string | null;
  };
}

export function safeLineUrl(value: string | undefined | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === "" ? parsed.toString() : null;
  } catch { return null; }
}

export function noStore(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
