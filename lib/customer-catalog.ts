import { singleFlight } from "./single-flight";

const pending = singleFlight<Record<string, unknown>>();
let snapshot: { key: string; data: Record<string, unknown>; expires: number } | undefined;
let generation = 0;
const keyFor = (idToken?: string, accessToken?: string) => JSON.stringify([idToken || "", accessToken || ""]);

// In-memory display data only. Never authorizes a mutation or survives logout/reload.
export function cachedMemberCatalog(idToken?: string, accessToken?: string) {
  return snapshot?.key === keyFor(idToken, accessToken) && snapshot.expires > Date.now() ? snapshot.data : undefined;
}

export function clearMemberCatalog() { generation++; snapshot = undefined; }

export function seedMemberCatalog(data: Record<string, unknown>, idToken?: string, accessToken?: string) {
  snapshot = { key: keyFor(idToken, accessToken), data, expires: Date.now() + 60_000 };
}

export function loadMemberCatalog(idToken?: string, accessToken?: string, { fresh=false }={}) {
  const cached=cachedMemberCatalog(idToken,accessToken);
  if(!fresh&&cached)return Promise.resolve(cached);
  const key = keyFor(idToken, accessToken);
  const requestedGeneration = generation;
  return pending(`${requestedGeneration}:${key}`, async () => {
    const response = await fetch("/api/line/member/catalog", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, accessToken }), cache: "no-store", signal: AbortSignal.timeout(12000),
    });
    const data = await response.json() as Record<string, unknown>;
    if (!response.ok) throw new Error(String(data.error || "โหลดสิทธิพิเศษไม่สำเร็จ"));
    if (generation === requestedGeneration) snapshot = { key, data, expires: Date.now() + 60_000 };
    return data;
  });
}
