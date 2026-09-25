import { supabase } from "./supabase/client";

export type PopupSource = "news" | "coupons";
export type PopupContent = { id: string; source: PopupSource; active: boolean };
export type PopupDisplay = PopupContent & {
  title: string; summary: string; details: string; image: string | null; images: string[];
  createdAt: string | null; startsAt: string | null; expiresAt: string | null; category: "ข่าวสาร" | "โปรโมชั่น" | "คูปอง";
};
export type PopupCatalogRow = {
  id: string; title: string; summary?: string; content?: string; description?: string; category?: string;
  image_url?: string | null; image_urls?: string[] | null; status?: string; active?: boolean;
  discount_type?: string; discount_value?: number; min_spend?: number;
  starts_at?: string | null; ends_at?: string | null; created_at?: string | null; expires_at?: string | null;
};
export type PopupCatalog = { news: PopupCatalogRow[]; coupons: PopupCatalogRow[] };
export const defaultPopupContent: PopupContent[] = [];

export function normalizePopupDisplay(value: unknown): PopupDisplay[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter(item => (item.source === "news" || item.source === "coupons") && typeof item.id === "string" && typeof item.title === "string")
    .map((item): PopupDisplay => ({
      id: String(item.id), source: item.source as PopupSource, active: item.active === true,
      title: String(item.title), summary: typeof item.summary === "string" ? item.summary : "",
      details: typeof item.details === "string" ? item.details : "",
      image: typeof item.image === "string" ? item.image : null,
      images: Array.isArray(item.images) ? item.images.filter((url): url is string => typeof url === "string") : typeof item.image === "string" ? [item.image] : [],
      createdAt: typeof item.createdAt === "string" ? item.createdAt : null,
      startsAt: typeof item.startsAt === "string" ? item.startsAt : null,
      expiresAt: typeof item.expiresAt === "string" ? item.expiresAt : null,
      category: item.source === "news" ? item.category === "โปรโมชั่น" ? "โปรโมชั่น" : "ข่าวสาร" : "คูปอง",
    }))
    .filter(item => !item.expiresAt || Date.parse(item.expiresAt) >= Date.now());
}

export function normalizePopupContent(value: unknown): PopupContent[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter(item => (item.source === "news" || item.source === "coupons") && typeof item.id === "string")
    .map(item => ({ id: String(item.id), source: item.source as PopupSource, active: item.active === true }));
}

export function popupKey(item: PopupContent): string { return `${item.source}:${item.id}`; }

export function formatPopupDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(date);
}

export function formatPopupDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "";
  if (!start) return `ถึง ${formatPopupDate(end!)}`;
  if (!end) return `เริ่ม ${formatPopupDate(start)}`;
  const parts = (value: string) => Object.fromEntries(
    new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" })
      .formatToParts(new Date(value)).map(part => [part.type, part.value])
  );
  const first = parts(start);
  const last = parts(end);
  if (first.year === last.year && first.month === last.month) return `${first.day}–${last.day} ${last.month} ${last.year}`;
  if (first.year === last.year) return `${first.day} ${first.month} – ${last.day} ${last.month} ${last.year}`;
  return `${first.day} ${first.month} ${first.year} – ${last.day} ${last.month} ${last.year}`;
}

export function formatCurrentPopupPeriod(start: string | null, end: string | null, now = Date.now()): string {
  if (end && (!start || Date.parse(start) <= now) && Date.parse(end) >= now) return `วันนี้–${formatPopupDate(end)}`;
  return formatPopupDateRange(start, end);
}

export async function loadPopupCatalog(): Promise<PopupCatalog> {
  if (!supabase) throw new Error("ยังไม่ได้ตั้งค่า Supabase");
  const [news, coupons] = await Promise.all([
    supabase.from("news").select("id,title,summary,content,category,image_url,image_urls,status,created_at,starts_at,expires_at").eq("status", "published"),
    supabase.from("coupons").select("id,title,description,image_url,active,discount_type,discount_value,min_spend,starts_at,ends_at,created_at").eq("active", true),
  ]);
  if (news.error || coupons.error) throw news.error || coupons.error;
  return { news: news.data || [], coupons: coupons.data || [] };
}

export async function refreshPublishedPopupContent(): Promise<void> {
  if (!supabase) return;
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return;
  const [settings, profile] = await Promise.all([
    supabase.from("store_settings").select("extra").eq("owner_id", auth.user.id).maybeSingle(),
    supabase.from("public_shop_profiles").select("card_design").eq("slug", "tammy").eq("owner_id", auth.user.id).maybeSingle(),
  ]);
  if (settings.error || profile.error) throw settings.error || profile.error;
  if (!profile.data) return;
  const extra = settings.data?.extra as Record<string, unknown> | null;
  const selected = normalizePopupContent(extra?.popup_content);
  const catalog = selected.length ? await loadPopupCatalog() : { news: [], coupons: [] };
  const currentDesign = profile.data.card_design as Record<string, unknown> | null;
  const updated = await supabase.from("public_shop_profiles")
    .update({ card_design: { ...currentDesign, popup_content: resolvePopupContent(selected, catalog).filter(item => item.active) }, updated_at: new Date().toISOString() })
    .eq("slug", "tammy").eq("owner_id", auth.user.id);
  if (updated.error) throw updated.error;
}

export function resolvePopupContent(items: PopupContent[], catalog: PopupCatalog): PopupDisplay[] {
  const now = Date.now();
  return items.flatMap(item => {
    const row = catalog[item.source].find(entry => entry.id === item.id);
    if (!row) return [];
    if (item.source === "news" && row.status !== "published") return [];
    if (item.source === "news" && row.expires_at && Date.parse(row.expires_at) < now) return [];
    if (item.source === "coupons" && (row.active !== true || (row.starts_at && Date.parse(row.starts_at) > now) || (row.ends_at && Date.parse(row.ends_at) < now))) return [];
    return [{ ...item, title: row.title, summary: item.source === "news" ? row.summary || "" : row.description || "",
      details: item.source === "news" ? row.content || "" : `${row.description || ""} · ${row.discount_type === "percent" ? `ลด ${row.discount_value || 0}%` : `ลด ฿${row.discount_value || 0}`} · ขั้นต่ำ ฿${row.min_spend || 0}`,
      image: row.image_urls?.[0] || row.image_url || null,
      images: row.image_urls?.length ? row.image_urls.slice(0, 10) : row.image_url ? [row.image_url] : [],
      createdAt: row.created_at || null, startsAt: row.starts_at || null, expiresAt: item.source === "news" ? row.expires_at || null : row.ends_at || null,
      category: item.source === "news" ? row.category === "โปรโมชั่น" ? "โปรโมชั่น" as const : "ข่าวสาร" as const : "คูปอง" as const }];
  });
}
