"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { PastelSelect } from "./pastel-select";

type Props = {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  label?: string;
  nameStart?: string;
  nameEnd?: string;
  embedded?: boolean;
  onClose?: () => void;
  single?: boolean;
  allowSingleDay?: boolean;
  min?: string;
  max?: string;
};
const dateOnly = (value: string) => value.slice(0, 10);
const thisMonth = (value: string) => {
  const [year, month] = (value || new Date().toISOString().slice(0, 10)).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
};
const display = (value: string) => value
  ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`))
  : "";

export function DateRangePicker({ start, end, onChange, label = "ช่วงวันที่", nameStart, nameEnd, embedded = false, onClose, single = false, allowSingleDay = false, min, max }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<CSSProperties>({});
  useLayoutEffect(() => {
    if (!open || embedded) return;
    const position = () => {
      const anchor = root.current;
      if (!anchor) return;
      const viewport = window.visualViewport;
      let left = viewport?.offsetLeft || 0;
      let right = left + (viewport?.width || document.documentElement.clientWidth);
      // Respect phone frames and any horizontally clipping/scrolling container.
      for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
        if (/auto|scroll|hidden|clip/.test(getComputedStyle(parent).overflowX)) {
          const bounds = parent.getBoundingClientRect();
          left = Math.max(left, bounds.left + parent.clientLeft);
          right = Math.min(right, bounds.left + parent.clientLeft + parent.clientWidth);
        }
      }
      const bounds = anchor.getBoundingClientRect();
      const width = Math.min(340, Math.max(0, right - left - 24));
      const x = Math.max(left + 12, Math.min(bounds.left, right - 12 - width));
      setPlacement({ left: x - bounds.left, right: "auto", width, maxWidth: "none" });
    };
    position();
    const observer = new ResizeObserver(position);
    if (root.current) observer.observe(root.current);
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      window.visualViewport?.removeEventListener("resize", position);
    };
  }, [open, embedded]);
  useEffect(() => {
    if (!open && !embedded) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        if (embedded) onClose?.();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        setOpen(false);
        if (embedded) onClose?.();
        root.current?.querySelector<HTMLButtonElement>(".date-range-trigger")?.focus();
      }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open, embedded, onClose]);
  const [month, setMonth] = useState(() => thisMonth(start));
  const [hover, setHover] = useState("");
  useEffect(() => { if (open || embedded) setMonth(thisMonth(start)); }, [open, embedded, start]);
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const firstWeekday = (month.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const rangeEnd = end || (hover >= start ? hover : "");
  function pick(day: string) {
    if ((min && day < min) || (max && day > max)) return;
    if (single) {
      onChange(day, "");
      setOpen(false);
      onClose?.();
      return;
    }
    if (!start || end || day < start) onChange(day, "");
    else { onChange(start, day); setOpen(false); onClose?.(); }
    setHover("");
  }
  return <div className="date-range-picker" ref={root}>
    {nameStart ? <input type="hidden" name={nameStart} value={start} /> : null}
    {nameEnd ? <input type="hidden" name={nameEnd} value={end} /> : null}
    {!embedded ? <button className="date-range-trigger" type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}><CalendarDays size={17} /><span>{single || (allowSingleDay && start && (!end || start === end)) ? (start ? display(dateOnly(start)) : "เลือกวันที่") : start ? `${display(dateOnly(start))}  –  ${end ? display(dateOnly(end)) : "เลือกวันสิ้นสุด"}` : allowSingleDay ? "เลือกวันที่หรือช่วงเวลา" : "เลือกวันเริ่ม–วันสิ้นสุด"}</span></button> : null}
    {open || embedded ? <div ref={panel} className="date-range-panel" style={embedded ? undefined : placement} role="group" aria-label={label}>
      <div className="date-range-caption">{single ? "เลือกวันที่" : allowSingleDay ? "เลือกวันเดียว หรือวันเริ่ม–วันสิ้นสุด" : "เลือกช่วงวันที่"}</div>
      <div className="date-range-nav"><button type="button" aria-label="เดือนก่อนหน้า" onClick={() => setMonth(new Date(Date.UTC(year, monthIndex - 1, 1)))}><ChevronLeft size={18} /></button><div className="date-range-nav-title"><strong>{new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: "UTC" }).format(month)}</strong><PastelSelect label="เลือกปี" value={String(year)} onChange={value => setMonth(new Date(Date.UTC(Number(value), monthIndex, 1)))} options={Array.from({ length: Math.max(year, new Date().getFullYear() + 10) - Math.min(year, 1900) + 1 }, (_, index) => Math.min(year, 1900) + index).map(option => ({ value: String(option), label: String(option + 543) }))} /></div><button type="button" aria-label="เดือนถัดไป" onClick={() => setMonth(new Date(Date.UTC(year, monthIndex + 1, 1)))}><ChevronRight size={18} /></button></div>
      <div className="date-range-grid">{["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((day) => <span key={day}>{day}</span>)}{Array.from({ length: firstWeekday }, (_, index) => <i key={index} />)}{Array.from({ length: days }, (_, index) => {
        const day = new Date(Date.UTC(year, monthIndex, index + 1)).toISOString().slice(0, 10);
        const edge = day === start || day === end;
        const between = Boolean(start && rangeEnd && day > start && day < rangeEnd);
        return <button type="button" key={day} disabled={Boolean((min && day < min) || (max && day > max))} className={`${edge ? "edge" : ""} ${between ? "between" : ""}`} aria-label={day} aria-pressed={edge} onMouseEnter={() => setHover(day)} onFocus={() => setHover(day)} onClick={() => pick(day)}>{index + 1}</button>;
      })}</div>
      <p>{single ? (start ? display(start) : "เลือกวันที่กลับมาเปิด") : !start ? allowSingleDay ? "คลิกวันเดียวเพื่อดูรายการของวันนั้น" : "กดวันเริ่มต้น" : !end ? allowSingleDay ? `แสดง ${display(start)} แล้ว · คลิกอีกวันเพื่อเลือกช่วงเวลา` : "กดวันสิ้นสุดเพื่อแรเงาช่วงเวลา" : `${display(start)} – ${display(end)}`}</p>
      <div className="date-range-actions"><button type="button" onClick={() => { onChange("", ""); setHover(""); }}>ล้าง{single ? "วันที่" : "ช่วงวัน"}</button></div>
    </div> : null}
  </div>;
}
