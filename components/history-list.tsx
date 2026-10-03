"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, ReceiptText } from "lucide-react";
import { historyMonth, type HistoryCursor, type HistoryEntry } from "@/lib/transaction-history";
import { historyRequest, historyScope, loadTransaction } from "@/lib/transaction-history-client";
import { ProfilePhoto } from "./profile-photo";

type Page = { rows: HistoryEntry[]; nextCursor: HistoryCursor | null };
const snapshots = new Map<string, { page: Page; at: number }>();
export function HistoryList({ filter, start = "", end = "", revision, grouped = false, onSelect }: { filter: string; start?: string; end?: string; revision: number; grouped?: boolean; onSelect: (entry: HistoryEntry) => void }) {
  const scopeKey = `${historyScope()}:${filter}:${start}:${end}`;
  const key = `${scopeKey}:${revision}`;
  const cached = snapshots.get(key);
  const [page, setPage] = useState<Page>(() => cached?.page || { rows: [], nextCursor: null });
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const sentinel = useRef<HTMLButtonElement>(null);
  const loadingMore = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const previousScope = useRef(scopeKey);
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort;
    const saved = snapshots.get(key);
    const sameScope = previousScope.current === scopeKey;
    previousScope.current = scopeKey;
    setPage(saved?.page || (sameScope ? page : { rows: [], nextCursor: null })); setError(""); setLoading(!saved && (!sameScope || page.rows.length === 0));
    if (saved && Date.now() - saved.at < 30000) return () => abort.abort();
    void historyRequest(new URLSearchParams({ filter, start, end }), abort.signal).then(result => {
      if (abort.signal.aborted) return;
      const next = { rows: result.rows as HistoryEntry[], nextCursor: result.nextCursor as HistoryCursor | null };
      if (snapshots.size >= 20) snapshots.delete(snapshots.keys().next().value!);
      snapshots.set(key, { page: next, at: Date.now() }); setPage(next);
    }).catch(cause => { if (!abort.signal.aborted) setError(cause.message); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [key, filter, start, end, retry]);
  useEffect(() => {
    let stopped = false;
    // Warm only the first visible items, sequentially, without blocking the list.
    void (async () => { for (const row of page.rows.slice(0, 5)) { if (stopped) break; await loadTransaction(row).catch(() => {}); } })();
    return () => { stopped = true; };
  }, [page.rows]);
  useEffect(() => {
    if (!page.nextCursor || loading || error || !sentinel.current) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || loadingMore.current) return;
      sentinel.current?.click();
    }, { root: root.current, rootMargin: "60px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [page.nextCursor, loading, error]);
  async function more() {
    if (!page.nextCursor || loadingMore.current) return;
    loadingMore.current = true; setLoading(true); setError("");
    const signal = controller.current?.signal;
    try {
      const result = await historyRequest(new URLSearchParams({ filter, start, end, cursor: JSON.stringify(page.nextCursor) }), signal);
      if (signal?.aborted) return;
      const ids = new Set(page.rows.map(row => `${row.kind}:${row.id}`));
      const next = { rows: [...page.rows, ...(result.rows as HistoryEntry[]).filter(row => !ids.has(`${row.kind}:${row.id}`))], nextCursor: result.nextCursor as HistoryCursor | null };
      snapshots.set(key, { page: next, at: Date.now() }); setPage(next);
    } catch (cause) { if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "โหลดเพิ่มไม่สำเร็จ"); }
    finally { loadingMore.current = false; if (!signal?.aborted) setLoading(false); }
  }
  return <div className="history-list-shell">
    <div className="history-table-labels"><span>วัน / ลูกค้า</span><span>รายการ</span><span>แต้ม</span></div>
    <div className="history-scroll" ref={root} tabIndex={0} aria-label="รายการประวัติ เลื่อนลงเพื่อดูเพิ่มเติม">
      {page.rows.map((row, index) => {
        const month = historyMonth(row.createdAt);
        const showMonth = grouped && (index === 0 || historyMonth(page.rows[index - 1].createdAt).key !== month.key);
        return <div key={`${row.kind}:${row.id}`}>
          {showMonth ? <h3 className="history-month-heading">{month.label}</h3> : null}
          <button className={`history-entry${row.status === "cancelled" ? " is-cancelled" : ""}`} type="button" onPointerEnter={() => void loadTransaction(row).catch(() => {})} onFocus={() => void loadTransaction(row).catch(() => {})} onClick={() => onSelect(row)}>
            <span className="history-entry-avatar"><ProfilePhoto src={row.memberPicture} size={38} /></span>
            <span className="history-entry-customer"><strong>{row.memberName}</strong><small>{new Date(row.createdAt).toLocaleDateString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", year: "numeric" })}</small></span>
            <span className="history-entry-title">{row.title}{row.status !== "completed" ? <small>{row.status === "cancelled" ? "ยกเลิกแล้ว" : "คืนบางส่วนแล้ว"}</small> : null}</span>
            <span className={`history-entry-points ${row.points < 0 ? "negative" : "positive"}`}>{row.points > 0 ? "+" : ""}{row.points.toLocaleString("th-TH")}<ChevronRight size={14} /></span>
          </button>
        </div>;
      })}
      {error ? <div className="history-empty" role="alert">{error}<button type="button" onClick={() => page.rows.length ? void more() : setRetry(value => value + 1)}>ลองอีกครั้ง</button></div> : null}
      {loading ? <p className="history-empty" role="status">{page.rows.length ? "กำลังเพิ่มรายการ…" : "กำลังอ่านประวัติ…"}</p> : !page.rows.length && !error ? <div className="history-empty"><ReceiptText size={28} /><p>ยังไม่มีรายการในช่วงนี้</p></div> : null}
      {page.nextCursor ? <button type="button" className="history-load-more" ref={sentinel} disabled={loading} onClick={() => void more()}>เลื่อนลงเพื่อดูเพิ่ม · หรือกดที่นี่</button> : page.rows.length ? <p className="history-list-end">ครบ {page.rows.length.toLocaleString()} รายการแล้ว</p> : null}
    </div>
  </div>;
}
