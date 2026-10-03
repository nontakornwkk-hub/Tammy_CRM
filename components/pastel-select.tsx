"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

export function PastelSelect({ value, options, onChange, label }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  useEffect(() => { if (open) root.current?.querySelector<HTMLElement>(`[data-option="${index}"]`)?.scrollIntoView({ block: "nearest" }); }, [open, index]);
  function choose(next: string) { onChange(next); setOpen(false); trigger.current?.focus(); }
  return <div className="pastel-select" ref={root} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault(); setOpen(true);
      setIndex(current => event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : !open ? Math.max(0, options.findIndex(option => option.value === value)) : Math.max(0, Math.min(options.length - 1, current + (event.key === "ArrowDown" ? 1 : -1))));
    } else if (open && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); choose(options[index].value); }
    else if (event.key === "Tab") setOpen(false);
  }}>
    <button ref={trigger} type="button" role="combobox" className="pastel-select-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${index}` : undefined} onClick={() => { setIndex(Math.max(0, options.findIndex(option => option.value === value))); setOpen(!open); }}>{options.find(option => option.value === value)?.label}<ChevronDown size={15} /></button>
    {open ? <div id={id} className="pastel-select-options" role="listbox" aria-label={label}>{options.map((option, position) => <div key={option.value} id={`${id}-${position}`} role="option" aria-selected={value === option.value} data-option={position} className={index === position ? "is-focused" : ""} onPointerMove={() => setIndex(position)} onClick={() => choose(option.value)}>{option.label}{value === option.value ? <Check size={14} /> : null}</div>)}</div> : null}
  </div>;
}
