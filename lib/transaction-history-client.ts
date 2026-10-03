"use client";

import { supabase } from "@/lib/supabase/client";
import { crmOwnerId, crmRole, verifiedCrmUser } from "@/lib/supabase/crm-data";
import type { HistoryEntry, TransactionDetail } from "./transaction-history";

export const historyScope = () => `${verifiedCrmUser()}:${crmOwnerId()}:${crmRole()}`;
const details = new Map<string, { detail: TransactionDetail; at: number }>();
const pending = new Map<string, Promise<TransactionDetail>>();
let generation = 0;
const keyFor = (entry: HistoryEntry) => `${historyScope()}:${entry.kind}:${entry.id}`;
export function cachedTransaction(entry: HistoryEntry) {
  const cached = details.get(keyFor(entry));
  return cached && Date.now() - cached.at < 60000 ? cached.detail : null;
}
export async function historyRequest(params: URLSearchParams, signal?: AbortSignal) {
  const scope = historyScope();
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (!token) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  const response = await fetch(`/api/admin/transactions?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal });
  const result = await response.json();
  if (scope !== historyScope()) throw new Error("บัญชีผู้ใช้เปลี่ยนแล้ว กรุณาเปิดรายการใหม่");
  if (!response.ok) throw new Error(result.error || "อ่านรายการไม่สำเร็จ");
  return result;
}
export function loadTransaction(entry: HistoryEntry, fresh = false) {
  const key = keyFor(entry);
  const cached = cachedTransaction(entry);
  if (!fresh && cached) return Promise.resolve(cached);
  const existing = pending.get(key);
  if (existing) return existing;
  const currentGeneration = generation;
  const request = historyRequest(new URLSearchParams({ id: entry.id, kind: entry.kind })).then(result => {
    if (currentGeneration === generation) {
      if (details.size >= 80) details.delete(details.keys().next().value!);
      details.set(key, { detail: result.detail, at: Date.now() });
    }
    return result.detail as TransactionDetail;
  }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
  pending.set(key, request);
  return request;
}
export function clearTransactionDetails() { generation++; details.clear(); pending.clear(); }
