"use client";

import { CustomerNavIcon } from "./customer-nav-icon";

const items = [
  { id: "rewards", label: "ของรางวัล" },
  { id: "coupons", label: "คูปอง" },
  { id: "home", label: "หน้าหลัก" },
  { id: "store", label: "ร้านของเรา" },
  { id: "account", label: "ข้อมูลของฉัน" },
] as const;

export type CustomerTab = typeof items[number]["id"];

export function CustomerNavigation({ activeTab, onSelect }: {
  activeTab: CustomerTab;
  onSelect: (tab: CustomerTab) => void;
}) {
  return <nav className="customer-nav customer-unified-nav" aria-label="เมนูหลัก">
    {items.map(({ id, label }) => <button type="button" key={id}
      className={activeTab === id ? "active" : ""} aria-current={activeTab === id ? "page" : undefined}
      onClick={() => { onSelect(id); window.scrollTo({ top: 0, behavior: "instant" }); }}>
      <span className="customer-unified-nav-icon"><CustomerNavIcon tab={id} /></span><span>{label}</span>
    </button>)}
  </nav>;
}
