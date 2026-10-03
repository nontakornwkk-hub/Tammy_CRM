import { supabase } from "./supabase/client";

const topic = "tammy-catalog-updates";
const event = "catalog-changed";

// Only a refresh hint is broadcast. Customers reload through their verified API.
export function notifyCatalogChanged() {
  window.dispatchEvent(new Event(event));
  if (!supabase) return;
  const channel = supabase.channel(topic);
  void channel.httpSend(event, {}, { timeout: 3000 })
    .catch(() => undefined).finally(() => { void supabase?.removeChannel(channel); });
}

export function watchCatalogChanges(refresh: () => void) {
  let lastRefresh = 0;
  let trailing: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    if (document.visibilityState === "hidden") return;
    clearTimeout(trailing);
    const elapsed = Date.now() - lastRefresh;
    if (elapsed < 1000) { trailing = setTimeout(run, 1000 - elapsed); return; }
    lastRefresh = Date.now();
    refresh();
  };
  const channel = supabase?.channel(topic).on("broadcast", { event }, run).subscribe();
  window.addEventListener(event, run);
  window.addEventListener("focus", run);
  window.addEventListener("online", run);
  document.addEventListener("visibilitychange", run);
  // Recover missed messages/reconnections without hiding existing cards.
  const timer = window.setInterval(run, 15_000);
  return () => {
    clearTimeout(trailing);
    clearInterval(timer);
    window.removeEventListener(event, run);
    window.removeEventListener("focus", run);
    window.removeEventListener("online", run);
    document.removeEventListener("visibilitychange", run);
    if (channel) void supabase?.removeChannel(channel);
  };
}
