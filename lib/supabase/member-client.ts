import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Customer phone sessions must never overwrite the staff CRM auth session.
export const memberAuth = url && key ? createClient(url, key, {
  auth: { storageKey: "tammy-customer-phone-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
}) : null;
