import { loadConnectionStatus } from "../connection-status";
import { supabase } from "./client";

export type AdminExtras = {
  sessions?: unknown[];
  team?: unknown[];
  databaseUsage?: unknown;
  storageUsage?: unknown;
};

let cache: { userId: string; ownerId: string; value: AdminExtras } | null = null;

export function cachedAdminExtras(userId: string, ownerId: string): AdminExtras | null {
  return cache?.userId === userId && cache.ownerId === ownerId ? cache.value : null;
}

export function clearAdminExtras() { cache = null; }

export async function prefetchAdminExtras(userId: string, ownerId: string, ownerMode: boolean) {
  if (!supabase) return;
  if (ownerMode) void loadConnectionStatus().catch(() => undefined);
  if (cachedAdminExtras(userId, ownerId)) return;
  const [sessions, team, database, storage] = await Promise.all([
    supabase.rpc("crm_my_sessions"),
    ownerMode ? supabase.from("team_accounts").select("id,name,email,role,active,user_id").eq("owner_id", ownerId).order("created_at") : Promise.resolve(null),
    ownerMode ? supabase.rpc("crm_database_usage") : Promise.resolve(null),
    ownerMode ? supabase.rpc("crm_storage_usage") : Promise.resolve(null),
  ]);
  const value: AdminExtras = {};
  if (!sessions.error) value.sessions = sessions.data || [];
  if (team && !team.error) value.team = team.data || [];
  if (database && !database.error) value.databaseUsage = Array.isArray(database.data) ? database.data[0] : database.data;
  if (storage && !storage.error) value.storageUsage = Array.isArray(storage.data) ? storage.data[0] : storage.data;
  cache = { userId, ownerId, value };
}
