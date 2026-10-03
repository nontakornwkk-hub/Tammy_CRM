type Profile = { member_id: string; line_picture_url: string | null };

const memory = new Map<string, Record<string, string>>();
const storageKey = (ownerId: string) => `tammy-line-pictures:${ownerId}`;

export function cachedLinePictures(ownerId: string | null): Record<string, string> {
  if (!ownerId) return {};
  const existing = memory.get(ownerId);
  if (existing) return existing;
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(ownerId)) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const pictures = Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].startsWith("https://")));
    memory.set(ownerId, pictures);
    return pictures;
  } catch { return {}; }
}

export function rememberLinePictures(ownerId: string, profiles: Profile[]): Record<string, string> {
  const pictures = { ...cachedLinePictures(ownerId), ...Object.fromEntries(profiles.filter(profile => profile.line_picture_url?.startsWith("https://")).map(profile => [profile.member_id, profile.line_picture_url!])) };
  memory.set(ownerId, pictures);
  try { window.localStorage.setItem(storageKey(ownerId), JSON.stringify(pictures)); } catch { /* The in-memory cache still works. */ }
  return pictures;
}
