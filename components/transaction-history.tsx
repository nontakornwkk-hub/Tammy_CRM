"use client";

import { notifyCatalogChanged } from "@/lib/catalog-live";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, CalendarDays, Clock3, Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { crmRole } from "@/lib/supabase/crm-data";
import { actionLabels, type HistoryEntry, type TransactionAction, type TransactionDetail } from "@/lib/transaction-history";
import { DateRangePicker } from "./date-range-picker";
import { PastelSelect } from "./pastel-select";
import { HistoryList } from "./history-list";
import { ProfilePhoto } from "./profile-photo";
import { cachedTransaction, clearTransactionDetails, loadTransaction } from "@/lib/transaction-history-client";

const formatTime = (value: string) => new Date(value).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
async function authorization() {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  if (!token) throw new Error("กรุณาเข้าสู่ระบบใหม่");
  return { Authorization: `Bearer ${token}` };
}

export function TransactionHistory({ revision, onChanged }: { revision: number; onChanged: () => void }) {
  const [range, setRange] = useState({ start: "", end: "" });
  const [mode, setMode] = useState("latest");
  const [filter, setFilter] = useState("earn");
  const [refresh, setRefresh] = useState(0);
  const [listView, setListView] = useState<{ start: string; end: string; all: boolean } | null>(null);
  const [selected, setSelected] = useState<HistoryEntry | null>(null);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [fresh, setFresh] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [action, setAction] = useState<TransactionAction | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const listDialog = useRef<HTMLDialogElement>(null);
  const previousRevision = useRef(revision);
  const combinedRevision = revision + refresh;
  const inlineDay = mode === "range" && range.start && (!range.end || range.end === range.start) ? range.start : "";
  const options = [{ value: "earn", label: "ให้แต้ม" }, ...(crmRole() !== "staff" ? [{ value: "redemption", label: "แลกสิทธิ์" }, { value: "all", label: "ทุกประเภท" }] : [])];
  function showList(start = "", end = "") { setListView({ start, end, all: !start }); }
  function openEntry(row: HistoryEntry) {
    setDetail(cachedTransaction(row)); setFresh(false); setDetailError(""); setAction(null); setReason(""); setSelected(row);
  }
  useEffect(() => {
    if (listView && !listDialog.current?.open) listDialog.current?.showModal();
  }, [listView]);
  useEffect(() => {
    if (previousRevision.current !== revision) clearTransactionDetails();
    previousRevision.current = revision;
  }, [revision]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    if (!dialog.current?.open) dialog.current?.showModal();
    void loadTransaction(selected, true).then(value => {
      if (active) { setDetail(value); setFresh(true); }
    }).catch(cause => { if (active) setDetailError(cause instanceof Error ? cause.message : "อ่านรายละเอียดไม่สำเร็จ"); });
    return () => { active = false; };
  }, [selected]);

  async function confirm() {
    if (!detail || !fresh || !detail.ready || !action || !detail.actions.includes(action) || busy || reason.trim().length < 3) return;
    setBusy(true); setDetailError("");
    dialog.current?.close(); setSelected(null);
    setNotice(`กำลัง${actionLabels[action]}…`);
    try {
      const response = await fetch("/api/admin/transactions", { method: "POST", headers: { ...await authorization(), "Content-Type": "application/json" }, body: JSON.stringify({ id: detail.id, kind: detail.kind, action, reason }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "ทำรายการไม่สำเร็จ");
      notifyCatalogChanged();
      setNotice(`${actionLabels[action]}สำเร็จ · แต้มคงเหลือ ${Number(result.result.points_after).toLocaleString("th-TH")}`);
      clearTransactionDetails(); setRefresh(value => value + 1); onChanged();
    } catch (cause) { setNotice(`ทำรายการไม่สำเร็จ: ${cause instanceof Error ? cause.message : "กรุณาลองอีกครั้ง"}`); }
    finally { setBusy(false); }
  }
  const delta = detail ? action === "restore_rights" ? 0 : detail.reversalPoints : 0;

  return <>
    <section className="panel recent-points transaction-history-panel">
      <div className="history-panel-heading"><h3><span><Clock3 size={20} /></span>ประวัติรายการ</h3><button type="button" className="history-view-all" onClick={() => showList()}>ดูทั้งหมด <ArrowUpRight size={15} /></button></div>
      <div className="history-time-tabs" aria-label="รูปแบบช่วงเวลา">{[{ value: "latest", label: "ล่าสุด" }, { value: "range", label: "เลือกช่วงเวลา" }].map(item => <button type="button" key={item.value} aria-pressed={mode === item.value} onClick={() => { setMode(item.value); if (item.value === "range" && range.start && range.end && range.start !== range.end) showList(range.start, range.end); }}>{item.value === "range" ? <CalendarDays size={13} /> : null}{item.label}</button>)}</div>
      <div className="transaction-history-filters">
        <PastelSelect label="ประเภทรายการ" value={filter} options={options} onChange={value => { setFilter(value); if (value === "all") showList(); }} />
        {mode === "range" ? <DateRangePicker allowSingleDay start={range.start} end={range.end} label="วันที่หรือช่วงเวลาประวัติ" onChange={(start, end) => { setRange({ start, end }); if (start && end && start !== end) showList(start, end); }} /> : <span className="history-filter-hint">รายการใหม่อยู่ด้านบน</span>}
      </div>
      {notice ? <p className="transaction-history-notice" role="status">{notice}</p> : null}
      <p className="transaction-history-help">{mode === "range" ? "คลิกวันเดียวเพื่อดูในกล่อง · คลิกวันสิ้นสุดอีกวันเพื่อเปิดช่วงเวลากลางหน้า" : "เลื่อนลงเพื่อดูเพิ่ม · กดรายการเพื่อดูรายละเอียด"}</p>
      <HistoryList filter={filter} start={inlineDay} end={inlineDay} revision={combinedRevision} onSelect={openEntry} />
    </section>
    <dialog className="transaction-detail-dialog history-all-dialog" ref={listDialog} aria-labelledby="history-all-title" onClose={() => setListView(null)}>
      <div className="transaction-detail-heading"><div><small><Sparkles size={13} /> ประวัติของร้าน</small><h2 id="history-all-title">{listView?.all ? "รายการทั้งหมด" : "รายการตามช่วงเวลา"}</h2></div><button type="button" aria-label="ปิดประวัติทั้งหมด" onClick={() => listDialog.current?.close()}><X size={19} /></button></div>
      <div className="transaction-history-filters">
        <PastelSelect label="ประเภทรายการในหน้าต่างประวัติ" value={filter} options={options} onChange={setFilter} />
        <DateRangePicker allowSingleDay start={listView?.start || ""} end={listView?.end || ""} label="เปลี่ยนช่วงเวลา" onChange={(start, end) => { setRange({ start, end }); setListView({ start, end, all: !start }); }} />
        {listView?.start ? <button type="button" className="history-clear-range" onClick={() => showList()}>ทุกช่วงเวลา</button> : null}
      </div>
      <p className="transaction-history-help">{listView?.all ? "แบ่งรายการตามเดือน · เลื่อนลงเพื่อดูย้อนหลัง" : "กดรายการเพื่อเปิดรายละเอียด · เลื่อนลงเพื่อดูเพิ่ม"}</p>
      {listView ? <HistoryList filter={filter} start={listView.start} end={listView.end || listView.start} revision={combinedRevision} grouped={listView.all} onSelect={openEntry} /> : <p className="history-empty">เลือกวันสิ้นสุดเพื่อแสดงรายการ</p>}
    </dialog>
    <dialog className="transaction-detail-dialog" ref={dialog} aria-labelledby="transaction-detail-title" onCancel={event => { if (busy) event.preventDefault(); }} onClose={() => { if (!busy) setSelected(null); }}>
      <div className="transaction-detail-heading"><div><small><Sparkles size={13} /> ประวัติรายการ</small><h2 id="transaction-detail-title">รายละเอียดรายการ</h2></div><button type="button" disabled={busy} aria-label="ปิดรายละเอียด" onClick={() => { dialog.current?.close(); setSelected(null); }}><X /></button></div>
      {detailError ? <p className="rewards-gallery-error" role="alert">{detailError}{!busy && selected ? <button type="button" className="history-clear-range" onClick={() => { setDetailError(""); setFresh(false); setSelected({ ...selected }); }}>ตรวจสอบอีกครั้ง</button> : null}</p> : null}
      {selected ? <>
        <div className="transaction-detail-member">
          <div className="transaction-member-identity"><span className="transaction-member-avatar"><ProfilePhoto src={detail?.memberPicture || selected.memberPicture} size={56} /></span><div><span className="transaction-detail-kicker">{selected.kind === "points" ? "รายการแต้ม" : "รายการแลกสิทธิ์"}</span><strong>{(detail || selected).memberName}</strong><span className="transaction-member-code">{detail?.memberCode || selected.memberCode || "สมาชิกของร้าน"}</span></div></div>
          <div className="transaction-member-summary"><span>{(detail || selected).title}</span><span className="transaction-status-chip">{(detail || selected).status === "cancelled" ? "ยกเลิกแล้ว" : (detail || selected).status === "partial" ? "คืนบางส่วนแล้ว" : "บันทึกแล้ว"}</span></div>
          <b className={"transaction-detail-delta" + (selected.points < 0 ? " negative" : "")}>{selected.points > 0 ? "+" : ""}{selected.points.toLocaleString()} <small>แต้ม</small></b>
        </div>
        {!fresh && !detailError ? <p className="transaction-history-help" role="status">กำลังตรวจสอบรายละเอียดล่าสุด…</p> : null}
        <dl className="transaction-detail-data">
          <div><dt>ผู้ดำเนินการ</dt><dd>{detail?.actor || "กำลังตรวจสอบ…"}</dd></div><div><dt>วันเวลา</dt><dd>{formatTime(selected.createdAt)}</dd></div>
          <div><dt>แต้มก่อน → หลัง</dt><dd>{!detail ? "กำลังตรวจสอบ…" : detail.pointsBefore == null || detail.pointsAfter == null ? "ไม่มีข้อมูลที่บันทึกไว้" : detail.pointsBefore.toLocaleString() + " → " + detail.pointsAfter.toLocaleString()}</dd></div>
          <div><dt>แต้มปัจจุบัน</dt><dd>{detail ? detail.currentPoints.toLocaleString() + " แต้ม" : "กำลังตรวจสอบ…"}</dd></div>
          <div className="transaction-reference"><dt>รหัสรายการ</dt><dd className="transaction-id">{selected.id}</dd></div>{detail?.note ? <div className="transaction-detail-note"><dt>หมายเหตุ</dt><dd>{detail.note}</dd></div> : null}
        </dl>
        <div className="transaction-detail-actions">{(["cancel", "refund_points", "restore_rights"] as TransactionAction[]).map(item => <button key={item} type="button" disabled={busy || !fresh || !detail?.ready || !detail.canManage || !detail.actions.includes(item)} aria-pressed={action === item} onClick={() => { setAction(item); setDetailError(""); }}>{actionLabels[item]}</button>)}</div>
        {crmRole() === "staff" ? <p className="transaction-history-help">เฉพาะเจ้าของร้านหรือผู้จัดการที่จัดการรายการได้</p> : detail && !detail.ready ? <p className="history-action-note">ปุ่มจัดการพร้อมแล้ว · รอเปิดใช้ระบบคืนรายการในฐานข้อมูล</p> : null}
        {selected.kind === "points" ? <p className="transaction-history-help">รายการให้แต้มใช้ “ยกเลิกรายการ” เพื่อหักแต้มที่ให้ไป ส่วน “คืนแต้ม / คืนสิทธิ์” ใช้กับรายการแลกสิทธิ์</p> : <p className="transaction-history-help">คืนแต้มสำหรับรายการที่หักแต้ม · คืนสิทธิ์เพื่อเปิดคูปองหรือคืนสต็อก โดยไม่คืนแต้ม</p>}
        {action && detail ? <div className="transaction-action-confirm"><h3>ยืนยัน{actionLabels[action]}</h3><p>{action === "restore_rights" ? detail.type === "coupon" ? "เปิดสิทธิ์คูปองให้ใช้ได้อีกครั้ง และยกเลิก QR เดิม" : "คืนสต็อกของรางวัล 1 ชิ้น โดยไม่คืนแต้ม" : detail.kind === "points" ? `หัก ${Math.abs(delta).toLocaleString()} แต้ม รวมโบนัสที่เกี่ยวข้อง และลดยอดซื้อสะสม ${detail.sale.toLocaleString()} บาท` : action === "cancel" ? "คืนแต้มที่ยังไม่ได้คืน และคืนสิทธิ์หรือสต็อกที่ยังไม่ได้คืน" : `คืน ${delta.toLocaleString()} แต้ม โดยไม่คืนสิทธิ์หรือสต็อก`}</p><p>แต้มปัจจุบัน {detail.currentPoints.toLocaleString()} → {(detail.currentPoints + delta).toLocaleString()}</p>
          <label>เหตุผล<textarea value={reason} maxLength={500} disabled={busy} onChange={event => setReason(event.target.value)} placeholder="ระบุเหตุผลอย่างน้อย 3 ตัวอักษร" /></label>
          <div><button type="button" disabled={busy} onClick={() => setAction(null)}>กลับ</button><button type="button" disabled={busy || reason.trim().length < 3 || detail.currentPoints + delta < 0} onClick={() => void confirm()}>{busy ? "กำลังบันทึก…" : `ยืนยัน${actionLabels[action]}`}</button></div>
        </div> : null}
        {detail?.events.length ? <div className="transaction-detail-events"><h3>ประวัติการคืนรายการ</h3>{detail.events.map((item, index) => <p key={index}><strong>{actionLabels[item.action as TransactionAction] || item.action}</strong> · {formatTime(item.createdAt)}<br />{item.reason}</p>)}</div> : null}
      </> : null}
    </dialog>
  </>;
}
