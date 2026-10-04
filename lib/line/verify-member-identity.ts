import "server-only";
import { verifyLineIdToken } from "./id-token";

type Identity = { sub: string; name: string | null; picture: string | null };
const pendingIdentities = new Map<string, Promise<Identity | null>>();

export function verifyMemberIdentity(input: { idToken?: string; accessToken?: string }, channelId: string): Promise<Identity | null> {
  const key = JSON.stringify([channelId, input.idToken || "", input.accessToken || ""]);
  const existing = pendingIdentities.get(key);
  if (existing) return existing;
  const request = resolveIdentity(input, channelId).finally(() => pendingIdentities.delete(key));
  pendingIdentities.set(key, request);
  return request;
}

async function resolveIdentity(input: { idToken?: string; accessToken?: string }, channelId: string): Promise<Identity | null> {
  if (input.idToken && input.idToken.length >= 20 && input.idToken.length <= 8192) {
    const local = await verifyLineIdToken(input.idToken, channelId);
    if (local) return local;
    if (local === undefined) {
      // Web-login HS256 and a temporary key-server failure retain LINE's verifier.
      const response = await fetch("https://api.line.me/oauth2/v2.1/verify", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ id_token: input.idToken, client_id: channelId }),
        cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      if (response.ok) {
        const identity = await response.json() as { aud?: string; sub?: string; name?: string; picture?: string };
        if (identity.aud === channelId && typeof identity.sub === "string" && /^U[0-9a-f]{32}$/.test(identity.sub))
          return { sub: identity.sub, name: typeof identity.name === "string" ? identity.name.slice(0,120) : null,
            picture: typeof identity.picture === "string" && identity.picture.startsWith("https://") ? identity.picture : null };
      } else {
        const detail = await response.json().catch(() => ({})) as { error?: string };
        console.warn("LINE ID token verification rejected", { status: response.status, code: detail.error || "unknown" });
      }
    }
  }
  const accessToken = input.accessToken;
  if (!accessToken || accessToken.length < 20 || accessToken.length > 8192) return null;
  const [verified, profileResponse] = await Promise.all([
    fetch(`https://api.line.me/oauth2/v2.1/verify?${new URLSearchParams({ access_token: accessToken })}`, {
      cache: "no-store", signal: AbortSignal.timeout(8000),
    }),
    fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(8000),
    }),
  ]);
  if (!verified.ok) return null;
  const access = await verified.json() as { client_id?: string; expires_in?: number; scope?: string };
  if (access.client_id !== channelId || !access.expires_in || access.expires_in <= 0 || !access.scope?.split(" ").includes("profile")) return null;
  if (!profileResponse.ok) return null;
  const profile = await profileResponse.json() as { userId?: string; displayName?: string; pictureUrl?: string };
  if (!profile.userId || !/^U[0-9a-f]{32}$/.test(profile.userId)) return null;
  return { sub: profile.userId, name: profile.displayName?.slice(0,120) || null, picture: profile.pictureUrl?.startsWith("https://") ? profile.pictureUrl : null };
}
