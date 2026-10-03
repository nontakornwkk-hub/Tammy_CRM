export type TransactionKind = "points" | "redemption";
export type TransactionAction = "cancel" | "refund_points" | "restore_rights";
export type HistoryEntry = { id: string; kind: TransactionKind; memberId: string; memberName: string; memberPicture?: string | null; memberCode?: string; createdAt: string; title: string; points: number; sale: number; status: string; type: string };
export type TransactionDetail = HistoryEntry & {
  actor: string; pointsBefore: number | null; pointsAfter: number | null; currentPoints: number;
  note: string; ready: boolean; canManage: boolean;
  actions: TransactionAction[]; reversalPoints: number; events: { action: string; reason: string; createdAt: string }[];
};
export const actionLabels: Record<TransactionAction, string> = { cancel: "ยกเลิกรายการ", refund_points: "คืนแต้ม", restore_rights: "คืนสิทธิ์" };
export type HistoryCursor = { at: string; id: string; kind: TransactionKind };
export function parseHistoryCursor(value: string | null): HistoryCursor | null {
  if (!value) return null;
  const cursor = JSON.parse(value);
  if (!cursor || !["points", "redemption"].includes(cursor.kind) || typeof cursor.at !== "string" || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|\+00:00)$/.test(cursor.at) || !Number.isFinite(Date.parse(cursor.at)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cursor.id)) throw new Error("รายการต่อเนื่องไม่ถูกต้อง");
  return cursor;
}
export function compareHistory(a: HistoryEntry, b: HistoryEntry) {
  return Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
}
export function historyMonth(value: string) {
  const date = new Date(value);
  return { key: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).format(date), label: new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", year: "numeric", month: "long" }).format(date) };
}
export function historyBounds(start: string, end: string) {
  if (!start && !end) return null;
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  if (!valid(start) || !valid(end) || start > end) throw new Error("กรุณาเลือกวันเริ่มต้นและวันสิ้นสุดให้ถูกต้อง");
  return { from: new Date(`${start}T00:00:00+07:00`).toISOString(), to: new Date(new Date(`${end}T00:00:00+07:00`).getTime() + 86400000).toISOString() };
}
export function availableActions(type: string, spent: number, status: string, flags: { cancelled?: boolean; points_refunded?: boolean; rights_restored?: boolean } | null): TransactionAction[] {
  if (flags?.cancelled || (status === "cancelled" && !flags?.rights_restored)) return [];
  if (type === "earn") return ["cancel"];
  if (type !== "reward" && type !== "coupon") return [];
  const actions: TransactionAction[] = [];
  if (!flags?.rights_restored || (spent > 0 && !flags?.points_refunded)) actions.push("cancel");
  if (spent > 0 && !flags?.points_refunded) actions.push("refund_points");
  if (!flags?.rights_restored) actions.push("restore_rights");
  return actions;
}
