export const pendingPhoneKey = "tammy-line-pending-phone";
const ttl = 5 * 60_000;

// Form continuation only: this never authenticates a member or replaces LINE verification.
export function pendingPhone(value: string | null, now = Date.now()): string | undefined {
  try {
    const item = JSON.parse(value || "null");
    if (item && /^0\d{9}$/.test(item.phone) && Number.isFinite(item.createdAt)
      && item.createdAt <= now && now - item.createdAt < ttl) return item.phone;
  } catch { /* Discard stale or invalid form state. */ }
}

export function phoneContinuation(phone: string, now = Date.now()) {
  return JSON.stringify({ phone, createdAt: now });
}
