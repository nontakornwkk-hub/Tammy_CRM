import { supabase } from "./supabase/client";
import { cachedData, clearCachedData, crmOwnerId, crmRole, loadCachedData, verifiedCrmUser } from "./supabase/crm-data";

export type LineConnectionStatus = {
  connected: boolean; channelId: string; channelSecret: boolean; accessToken: boolean;
  loginChannelId: string; liffId: string; liff: boolean; membershipUrl: string;
  bot: { displayName: string; basicId: string; pictureUrl?: string | null } | null;
  webhook: { endpoint: string; active: boolean } | null; webhookTested?: boolean; message?: string;
};
export type SupabaseConnectionStatus = { configured: { url: boolean; publishable: boolean; secret: boolean }; checks: { url: boolean; publishable: boolean; secret: boolean }; localSaveAvailable: boolean; projectUrl: string };
export type ConnectionSnapshot = { server: SupabaseConnectionStatus; line: LineConnectionStatus | null; lineError: string };
const key = "connection-status";
function sessionKey() { return `tammy-connection-status:${verifiedCrmUser()}:${crmOwnerId()}`; }
export function cachedConnectionStatus(): ConnectionSnapshot | null {
  if (!verifiedCrmUser() || crmRole() !== "owner") return null;
  const memory = cachedData<ConnectionSnapshot>(key);
  if (memory) return memory;
  try {
    const stored = JSON.parse(sessionStorage.getItem(sessionKey()) || "null");
    if (!stored || typeof stored.savedAt !== "number" || Date.now() - stored.savedAt > 3600000 || stored.savedAt > Date.now() || !stored.value?.server?.checks || !stored.value.server.configured || typeof stored.value.server.checks.secret !== "boolean") return null;
    return stored.value as ConnectionSnapshot;
  } catch { return null; }
}
function rememberSnapshot(snapshot: ConnectionSnapshot) {
  const connection = snapshot.line;
  // Persist a credential-free status snapshot only; input values are never cached.
  const safe: ConnectionSnapshot = {
    server: { configured: { url: Boolean(snapshot.server.configured.url), publishable: Boolean(snapshot.server.configured.publishable), secret: Boolean(snapshot.server.configured.secret) }, checks: { url: Boolean(snapshot.server.checks.url), publishable: Boolean(snapshot.server.checks.publishable), secret: Boolean(snapshot.server.checks.secret) },
      localSaveAvailable: snapshot.server.localSaveAvailable, projectUrl: snapshot.server.projectUrl },
    line: connection ? { connected: connection.connected, channelId: connection.channelId,
      channelSecret: Boolean(connection.channelSecret), accessToken: Boolean(connection.accessToken),
      loginChannelId: connection.loginChannelId, liffId: connection.liffId, liff: connection.liff,
      membershipUrl: connection.membershipUrl, bot: connection.bot ? { displayName: connection.bot.displayName, basicId: connection.bot.basicId, pictureUrl: connection.bot.pictureUrl } : null, webhook: connection.webhook ? { endpoint: connection.webhook.endpoint, active: connection.webhook.active } : null } : null,
    lineError: snapshot.lineError,
  };
  try { sessionStorage.setItem(sessionKey(), JSON.stringify({ savedAt: Date.now(), value: safe })); } catch { /* Memory cache remains available. */ }
  return safe;
}
export async function loadConnectionStatus(force = false) {
  const ownerId = crmOwnerId();
  if (!ownerId || crmRole() !== "owner") throw new Error("เฉพาะเจ้าของร้านเท่านั้น");
  if (force) clearCachedData(key);
  return loadCachedData(ownerId, key, async () => {
    const token = (await supabase?.auth.getSession())?.data.session?.access_token;
    if (!token) throw new Error("กรุณาเข้าสู่ระบบอีกครั้ง");
    const read = async <T>(path: string) => {
      const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ตรวจสถานะไม่สำเร็จ");
      return result as T;
    };
    const [server, line] = await Promise.allSettled([
      read<SupabaseConnectionStatus>("/api/line/messaging/supabase-config"),
      read<LineConnectionStatus>("/api/line/messaging/connection"),
    ]);
    if (server.status === "rejected") throw server.reason;
    // Status responses contain booleans only for credentials, never their values.
    if (crmOwnerId() !== ownerId || crmRole() !== "owner") throw new Error("บัญชีมีการเปลี่ยนแปลง");
    return rememberSnapshot({ server: server.value, line: line.status === "fulfilled" ? line.value : null,
      lineError: line.status === "rejected" ? line.reason instanceof Error ? line.reason.message : "ตรวจ LINE ไม่สำเร็จ" : "" });
  });
}
