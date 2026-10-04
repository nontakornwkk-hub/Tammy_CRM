import "server-only";
import { createRemoteJWKSet, decodeProtectedHeader, errors, jwtVerify } from "jose";
export type LineIdentity = { sub: string; name: string | null; picture: string | null };
// The issuer's public keys are cached, never a user's authorization result.
// Neither a token's jku/x5u nor a client-supplied URL can choose the key source.
const keys = createRemoteJWKSet(new URL("https://api.line.me/oauth2/v2.1/certs"), {
  timeoutDuration: 2500, cooldownDuration: 30000, cacheMaxAge: 600000,
});
export function prepareLineIdToken(token?: string) {
  if (!token || token.length > 8192) return;
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg === "ES256" && typeof header.kid === "string" && header.kid.length <= 200) {
      // Begin fetching keys while the shop/channel lookup is in flight.
      void keys(header).catch(() => undefined);
    }
  } catch { /* Malformed tokens are rejected during verification. */ }
}
// undefined means use LINE's online verifier (HS256 or unavailable public keys).
// null means the signature/claims are invalid; it must never authorize a member.
export async function verifyLineIdToken(token: string, channelId: string): Promise<LineIdentity | null | undefined> {
  if (token.length < 20 || token.length > 8192) return null;
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg === "HS256") return undefined;
    if (header.alg !== "ES256" || typeof header.kid !== "string" || !header.kid || header.kid.length > 200) return null;
    const { payload } = await jwtVerify(token, keys, {
      algorithms: ["ES256"], issuer: "https://access.line.me", audience: channelId,
      requiredClaims: ["sub", "iat", "exp"], clockTolerance: 0,
    });
    if (payload.aud !== channelId || typeof payload.sub !== "string" || !/^U[0-9a-f]{32}$/.test(payload.sub)
      || typeof payload.iat !== "number" || payload.iat > Date.now()/1000 + 60
      || typeof payload.exp !== "number" || payload.exp <= payload.iat) return null;
    return { sub: payload.sub, name: typeof payload.name === "string" ? payload.name.slice(0,120) : null,
      picture: typeof payload.picture === "string" && payload.picture.startsWith("https://") ? payload.picture : null };
  } catch (cause) {
    if (cause instanceof errors.JWTExpired || cause instanceof errors.JWTClaimValidationFailed
      || cause instanceof errors.JWSSignatureVerificationFailed || cause instanceof errors.JWSInvalid
      || cause instanceof errors.JWTInvalid || cause instanceof errors.JOSEAlgNotAllowed
      || cause instanceof errors.JOSENotSupported) return null;
    return undefined;
  }
}
