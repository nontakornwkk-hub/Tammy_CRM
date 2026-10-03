import { createHmac, timingSafeEqual } from "node:crypto";

export type ArchiveScope = { year: number | null; cutoff: string };
export function archiveScope(year: string | null): ArchiveScope | null {
  const now = new Date();
  if (year === "all") return { year: null, cutoff: now.toISOString() };
  const value = Number(year);
  const current = Number(new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric" }).format(now));
  return Number.isInteger(value) && value >= 2020 && value <= current ? { year: value, cutoff: now.toISOString() } : null;
}
export function scopeBounds(scope: ArchiveScope) {
  return scope.year === null ? null : { from: `${scope.year}-01-01T00:00:00+07:00`, to: `${scope.year + 1}-01-01T00:00:00+07:00` };
}
export type ArchiveReceipt = ArchiveScope & { owner: string; actor: string; count: number; fingerprint: string; expires: number };
function secret() {
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("ฐานข้อมูลไม่พร้อม");
  return key;
}
export function signArchive(receipt: ArchiveReceipt) {
  const payload = Buffer.from(JSON.stringify(receipt)).toString("base64url");
  return `${payload}.${createHmac("sha256", secret()).update(payload).digest("base64url")}`;
}
export function verifyArchive(token: unknown): ArchiveReceipt | null {
  if (typeof token !== "string" || token.length > 3000) return null;
  try {
    const [payload, signature, extra] = token.split(".");
    const expected = createHmac("sha256", secret()).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (extra || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const receipt = JSON.parse(Buffer.from(payload, "base64url").toString()) as ArchiveReceipt;
    return receipt.expires > Date.now() ? receipt : null;
  } catch { return null; }
}
