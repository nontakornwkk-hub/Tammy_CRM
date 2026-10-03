"use client";

import { useSyncExternalStore } from "react";
const key = "tammy-sidebar-collapsed";
const eventName = "tammy-sidebar-layout-changed";
function subscribe(onChange: () => void) {
  window.addEventListener(eventName, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(eventName, onChange); window.removeEventListener("storage", onChange); };
}
let fallback = false;
function snapshot() {
  try { return window.localStorage.getItem(key) === "true"; } catch { return fallback; }
}
export function useSidebarCollapsed() {
  const collapsed = useSyncExternalStore(subscribe, snapshot, () => false);
  const toggle = () => {
    fallback = !snapshot();
    try { window.localStorage.setItem(key, String(fallback)); } catch { /* Retain an in-memory preference when storage is unavailable. */ }
    window.dispatchEvent(new Event(eventName));
  };
  return [collapsed, toggle] as const;
}
