import type { MemberRow, MemberTagDefinition } from "@/lib/database.types";
import { supabase } from "./client";

type CacheEntry = { value: unknown; updatedAt: number };
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<unknown>>();
const revisions = new Map<string, number>();
const FRESH_MS = 30_000;
let verifiedUserId: string | null = null;
let verifiedOwnerId: string | null = null;
let verifiedRole: "owner" | "manager" | "staff" | null = null;
let authEpoch = 0;

export function verifiedCrmUser() { return verifiedUserId; }
export function crmOwnerId() { return verifiedOwnerId; }
export function crmRole() { return verifiedRole; }

export function setVerifiedCrmUser(userId: string | null, ownerId: string | null = userId, role: "owner" | "manager" | "staff" | null = userId ? "owner" : null) {
  if (verifiedUserId !== userId || verifiedOwnerId !== ownerId || verifiedRole !== role) { cache.clear(); pending.clear(); revisions.clear(); authEpoch += 1; }
  verifiedUserId = userId;
  verifiedOwnerId = ownerId;
  verifiedRole = role;
}

function cacheKey(key: string) { return `${verifiedUserId}:${verifiedOwnerId}:${key}`; }

export function cachedData<T>(key: string): T | null {
  return verifiedUserId && verifiedOwnerId ? (cache.get(cacheKey(key))?.value as T | undefined) ?? null : null;
}

export function clearCachedData(...keys: string[]) {
  if (!keys.length) { cache.clear(); pending.clear(); revisions.clear(); return; }
  if (verifiedUserId && verifiedOwnerId) keys.forEach((key) => {
    const scopedKey = cacheKey(key);
    cache.delete(scopedKey);
    pending.delete(scopedKey);
    revisions.set(scopedKey, (revisions.get(scopedKey) ?? 0) + 1);
  });
}

export async function loadCachedData<T>(ownerId: string, key: string, loader: () => Promise<T>, force = false): Promise<T> {
  if (!verifiedUserId || !verifiedOwnerId || verifiedOwnerId !== ownerId) throw new Error("กรุณาตรวจสอบสิทธิ์ก่อนโหลดข้อมูล");
  const scopedKey = cacheKey(key);
  const previous = cache.get(scopedKey);
  if (!force && previous && Date.now() - previous.updatedAt < FRESH_MS) return previous.value as T;
  const existing = pending.get(scopedKey);
  if (existing) return existing as Promise<T>;
  const revision = revisions.get(scopedKey) ?? 0;
  const requestEpoch = authEpoch;
  const request = loader().then((value) => {
    if (verifiedOwnerId === ownerId && authEpoch === requestEpoch && (revisions.get(scopedKey) ?? 0) === revision) cache.set(scopedKey, { value, updatedAt: Date.now() });
    return value;
  }).finally(() => { if (pending.get(scopedKey) === request) pending.delete(scopedKey); });
  pending.set(scopedKey, request);
  return request;
}

function client() {
  if (!supabase) throw new Error("ยังไม่ได้ตั้งค่า Supabase");
  return supabase;
}

export async function fetchMembersData(ownerId: string) {
  const db = client();
  const [members, pets, tags] = await Promise.all([
    db.from("members").select("*").eq("owner_id", ownerId).order("member_number", { ascending: true }).order("created_at", { ascending: true }),
    db.from("pets").select("member_id,name,species,breed,sex,birth_date").eq("owner_id", ownerId).order("created_at"),
    db.from("member_tag_definitions").select("*").eq("owner_id", ownerId).order("created_at"),
  ]);
  if (members.error || pets.error || tags.error) throw members.error ?? pets.error ?? tags.error;
  return { members: members.data as MemberRow[], pets: pets.data ?? [], tags: (tags.data ?? []) as MemberTagDefinition[] };
}

export async function fetchPointsData(ownerId: string) {
  const db = client();
  const year = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric" }).format(new Date()));
  const [members, transactions, settings, birthdays] = await Promise.all([
    db.from("members").select("*").eq("owner_id", ownerId).order("member_number", { ascending: true }).order("created_at", { ascending: true }),
    db.from("points_transactions").select("id,created_at,member_id,sale_amount,points_delta,transaction_type,note").eq("owner_id", ownerId).eq("transaction_type", "earn").gt("points_delta", 0).order("created_at", { ascending: false }).limit(100),
    db.from("store_settings").select("extra,points_spend,points_earned").eq("owner_id", ownerId).maybeSingle(),
    db.from("points_transactions").select("member_id,birthday_bonus_year").eq("owner_id", ownerId).eq("birthday_bonus_year", year),
  ]);
  if (members.error || transactions.error || settings.error || birthdays.error) throw members.error ?? transactions.error ?? settings.error ?? birthdays.error;
  return { members: members.data ?? [], transactions: transactions.data ?? [], settings: settings.data, birthdays: birthdays.data ?? [] };
}

export async function fetchRewardsData(ownerId: string) {
  const db = client();
  const tables = ["rewards", "coupons", "news"] as const;
  const results = await Promise.all(tables.map(async (table) => {
    const query = db.from(table).select("*").eq("owner_id", ownerId);
    const result = await (table === "coupons" ? query.is("archived_at", null) : query)
      .order("created_at", { ascending: false }).order("id", { ascending: true });
    if (result.error) throw result.error;
    return { table, rows: result.data ?? [] };
  }));
  return results;
}

async function fetchAllRows(ownerId: string, table: "members" | "points_transactions", columns: string) {
  const db = client();
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0;; offset += 1000) {
    const { data, error } = await db.from(table).select(columns).eq("owner_id", ownerId).order("id").range(offset, offset + 999);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as Record<string, unknown>[]));
    if (!data || data.length < 1000) return rows;
  }
}

export async function fetchReportsData(ownerId: string) {
  const [members, transactions] = await Promise.all([
    fetchAllRows(ownerId, "members", "id,name,member_code,level,created_at,last_visit"),
    fetchAllRows(ownerId, "points_transactions", "id,member_id,sale_amount,points_delta,created_at,transaction_type"),
  ]);
  return { members, transactions };
}

export function prefetchCrmPage(path: string): Promise<unknown> | undefined {
  if (!supabase || !verifiedOwnerId || !verifiedRole) return;
  if (verifiedRole === "staff" && path !== "/points") return;
  const ownerId = verifiedOwnerId;
  const queries: Record<string, () => Promise<unknown>> = {
    "/members": () => loadCachedData(ownerId, "members", () => fetchMembersData(ownerId)),
    "/points": () => loadCachedData(ownerId, "points", () => fetchPointsData(ownerId)),
    "/rewards": () => loadCachedData(ownerId, "rewards", () => fetchRewardsData(ownerId)),
    "/reports": () => loadCachedData(ownerId, "reports", () => fetchReportsData(ownerId)),
  };
  return queries[path]?.().catch(() => undefined);
}

export async function prefetchCrmPages() {
  const paths = verifiedRole === "staff" ? ["/points"] : ["/points", "/members", "/rewards", "/reports"];
  await Promise.all(paths.map((path) => prefetchCrmPage(path)));
}
