"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (month: string) => void;
  label: string;
  exclude?: string;
  align?: "left" | "right";
};

const monthLabel = (month: string, short = false) => new Intl.DateTimeFormat("th-TH", {
  month: short ? "short" : "long",
  year: short ? undefined : "numeric",
  timeZone: "UTC",
}).format(new Date(month + "-01T12:00:00Z"));

export function ReportMonthPicker({ value, onChange, label, exclude, align = "left" }: Props) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const todayParts = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "2-digit", timeZone: "Asia/Bangkok" }).formatToParts(new Date());
  const thisMonth = todayParts.find(part => part.type === "year")?.value + "-" + todayParts.find(part => part.type === "month")?.value;

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [open]);

  return <div className={"report-month-field " + (align === "right" ? "align-right" : "")} ref={root}>
    <span className="report-month-label">{label}</span>
    <button ref={trigger} type="button" className="report-month-trigger" aria-label={label + " " + monthLabel(value)} aria-haspopup="dialog" aria-expanded={open} onClick={() => { setYear(Number(value.slice(0, 4))); setOpen(!open); }}>
      <CalendarDays size={17} /><span>{monthLabel(value)}</span><ChevronDown size={15} />
    </button>
    {open ? <div className="report-month-panel" role="dialog" aria-label={"เลือก" + label}>
      <div className="report-month-year">
        <button type="button" aria-label="ปีก่อนหน้า" onClick={() => setYear(current => current - 1)}><ChevronLeft size={18} /></button>
        <strong>ปี {year + 543}</strong>
        <button type="button" aria-label="ปีถัดไป" disabled={year >= Number(thisMonth.slice(0, 4))} onClick={() => setYear(current => current + 1)}><ChevronRight size={18} /></button>
      </div>
      <div className="report-month-grid">{Array.from({ length: 12 }, (_, index) => {
        const month = year + "-" + String(index + 1).padStart(2, "0");
        return <button key={month} type="button" aria-pressed={month === value} disabled={month > thisMonth || month === exclude} className={month === thisMonth ? "is-today" : ""} onClick={() => { onChange(month); setOpen(false); trigger.current?.focus(); }}>{monthLabel(month, true)}</button>;
      })}</div>
      <div className="report-month-hint">เลือกเดือนที่ต้องการเปรียบเทียบ</div>
    </div> : null}
  </div>;
}
