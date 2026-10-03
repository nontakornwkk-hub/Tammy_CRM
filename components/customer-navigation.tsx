"use client";

import type { CSSProperties } from "react";
import { CustomerNavIcon } from "./customer-nav-icon";

const items = [
  { id: "rewards", label: "ของรางวัล" },
  { id: "coupons", label: "คูปอง" },
  { id: "home", label: "หน้าหลัก" },
  { id: "lucky", label: "ลุ้นรางวัล" },
  { id: "account", label: "ข้อมูลของฉัน" },
] as const;

export type CustomerTab = typeof items[number]["id"];

export function CustomerNavigation({ activeTab, onSelect }: {
  activeTab: CustomerTab;
  onSelect: (tab: CustomerTab) => void;
}) {
  return <nav className="customer-nav customer-soft-nav" aria-label="เมนูหลัก"
    style={{ "--customer-active-tab": items.findIndex(item => item.id === activeTab) } as CSSProperties}>
    {items.map(({ id, label }) => <button type="button" key={id}
      className={activeTab === id ? "active" : ""} aria-current={activeTab === id ? "page" : undefined}
      onClick={() => { onSelect(id); window.scrollTo({ top: 0, behavior: "instant" }); }}>
      <span className="customer-soft-nav-icon"><CustomerNavIcon tab={id} /></span><span>{label}</span>
    </button>)}
  </nav>;
}
