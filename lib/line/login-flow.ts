type Entry = { signedOut:boolean; connectRequested:boolean; liffCallback:boolean; pendingTransfer:boolean; inClient:boolean };
// Opening a rich-menu LIFF URL already expresses login intent. Preserve explicit logout.
export function shouldInitializeLine(entry:Entry) {
  return (!entry.signedOut || entry.connectRequested) && (entry.inClient || entry.connectRequested || entry.liffCallback || entry.pendingTransfer);
}
