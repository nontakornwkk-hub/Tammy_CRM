"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
};
const dateOnly = (value: string) => value.slice(0, 10);
const thisMonth = (value: string) => {
  const [year, month] = (value || new Date().toISOString().slice(0, 10)).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
};
const display = (value: string) => value
  ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`))
  : "";

export function DateRangePicker({ start, end, onChange, label = "ช่วงวันที่", nameStart, nameEnd, embedded = false, onClose, single = false }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open && !embedded) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        if (embedded) onClose?.();
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
    if (single) {
      onChange(day, "");
      setOpen(false);
      onClose?.();
      return;
    }
    if (!start || end || day < start) onChange(day, "");
    else onChange(start, day);
    setHover("");
  }
  return <div className="date-range-picker" ref={root}>
    {nameStart ? <input type="hidden" name={nameStart} value={start} /> : null}
    {nameEnd ? <input type="hidden" name={nameEnd} value={end} /> : null}
    {!embedded ? <button className="date-range-trigger" type="button" aria-expanded={open} onClick={() => setOpen(!open)}><CalendarDays size={17} /><span>{single ? (start ? display(dateOnly(start)) : "เลือกวันที่") : start ? `${display(dateOnly(start))}  –  ${end ? display(dateOnly(end)) : "เลือกวันสิ้นสุด"}` : "เลือกวันเริ่ม–วันสิ้นสุด"}</span></button> : null}
    {open || embedded ? <div className="date-range-panel" role="group" aria-label={label}>
      <div className="date-range-caption">{single ? "เลือกวันที่" : "เลือกช่วงวันที่"}</div>
      <div className="date-range-nav"><button type="button" aria-label="เดือนก่อนหน้า" onClick={() => setMonth(new Date(Date.UTC(year, monthIndex - 1, 1)))}><ChevronLeft size={18} /></button><div className="date-range-nav-title"><strong>{new Intl.DateTimeFormat("th-TH", { month: "long", timeZone: "UTC" }).format(month)}</strong><select aria-label="เลือกปี" value={year} onChange={event => setMonth(new Date(Date.UTC(Number(event.target.value), monthIndex, 1)))}>{Array.from({ length: new Date().getFullYear() - 1899 + 11 }, (_, index) => 1900 + index).map(option => <option key={option} value={option}>{option + 543}</option>)}</select></div><button type="button" aria-label="เดือนถัดไป" onClick={() => setMonth(new Date(Date.UTC(year, monthIndex + 1, 1)))}><ChevronRight size={18} /></button></div>
      <div className="date-range-grid">{["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"].map((day) => <span key={day}>{day}</span>)}{Array.from({ length: firstWeekday }, (_, index) => <i key={index} />)}{Array.from({ length: days }, (_, index) => {
        const day = new Date(Date.UTC(year, monthIndex, index + 1)).toISOString().slice(0, 10);
        const edge = day === start || day === end;
        const between = Boolean(start && rangeEnd && day > start && day < rangeEnd);
        return <button type="button" key={day} className={`${edge ? "edge" : ""} ${between ? "between" : ""}`} aria-label={day} aria-pressed={edge} onMouseEnter={() => setHover(day)} onFocus={() => setHover(day)} onClick={() => pick(day)}>{index + 1}</button>;
      })}</div>
      <p>{single ? (start ? display(start) : "เลือกวันที่กลับมาเปิด") : !start ? "กดวันเริ่มต้น" : !end ? "กดวันสิ้นสุดเพื่อแรเงาช่วงเวลา" : `${display(start)} – ${display(end)}`}</p>
      <div className="date-range-actions"><button type="button" onClick={() => { onChange("", ""); setHover(""); }}>ล้าง{single ? "วันที่" : "ช่วงวัน"}</button></div>
    </div> : null}
  </div>;
}
