"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSidebarCollapsed } from "@/lib/sidebar-preference";
import { CustomerNavIcon } from "./customer-nav-icon";
import { loadSettings } from "@/lib/settings";
import { supabase } from "@/lib/supabase/client";
import { crmRole, prefetchCrmPage } from "@/lib/supabase/crm-data";
import {
  ChevronRight,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PawPrint,
  X,
} from "lucide-react";

const navigation = [
  { label: "ให้แต้ม", detail: "เพิ่ม / ลดแต้มสมาชิก", art: "points", href: "/points" },
  { label: "สมาชิก", detail: "จัดการข้อมูลสมาชิก", art: "members", href: "/members" },
  { label: "แดชบอร์ดวิเคราะห์", detail: "สรุปยอดและรายงาน", art: "reports", href: "/reports" },
  { label: "ของรางวัล คูปอง และข่าวสาร", detail: "จัดการของรางวัล คูปอง โปรโมชั่น", art: "rewards", href: "/rewards" },
  { label: "ลุ้นของรางวัล", detail: "เกม สิทธิ์สะสม และรับรางวัล", art: "lucky", href: "/games" },
  { label: "ตั้งค่าระบบ", detail: "จัดการระบบและสิทธิ์ผู้ใช้", art: "settings", href: "/settings" },
];

type Brand = { logo: string; name: string; subtitle: string; x: number; y: number; zoom: number };
const defaultBrand: Brand = { logo: "", name: "Tammy", subtitle: "Pet Shop CRM", x: 50, y: 50, zoom: 1 };
let cachedBrand: Brand | null = null;

function readBrand(): Brand {
  const settings = loadSettings();
  return {
    logo: settings.logoDataUrl,
    name: settings.shopName,
    subtitle: settings.shopNameEn,
    x: settings.logoPositionX,
    y: settings.logoPositionY,
    zoom: settings.logoZoom,
  };
}

function sameBrand(a: Brand, b: Brand) {
  return a.logo === b.logo && a.name === b.name && a.subtitle === b.subtitle && a.x === b.x && a.y === b.y && a.zoom === b.zoom;
}

export function Sidebar({ activePath, onClose, preview = false }: { activePath: "/points" | "/members" | "/rewards" | "/settings" | "/reports" | "/games"; onClose?: () => void; preview?: boolean }) {
  const router = useRouter();
  const [brand, setBrand] = useState<Brand>(() => cachedBrand ?? defaultBrand);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const role = preview ? "owner" : crmRole();
  const visibleNavigation = navigation.filter(({ href }) => role === "owner" || role === "manager" || role === "staff" && (href === "/points" || href === "/settings" || href === "/games"));

  useEffect(() => {
    const refresh = () => {
      const next = readBrand();
      cachedBrand = next;
      setBrand((current) => sameBrand(current, next) ? current : next);
    };
    refresh();
    window.addEventListener("tammy-settings-changed", refresh);
    return () => window.removeEventListener("tammy-settings-changed", refresh);
  }, []);

    useEffect(() => {
    const neighbor = activePath === "/points" ? "/members" : activePath === "/members" ? "/points" : null;
    if (!neighbor) return;
    const timer = window.setTimeout(() => prefetchCrmPage(neighbor), 900);
    return () => window.clearTimeout(timer);
  }, [activePath]);

  return (
<aside className={`sidebar sidebar-reference${collapsed ? " is-collapsed" : ""}`}>
      <div className="brand">
        {brand.logo ? <Image src={brand.logo} alt="โลโก้ร้าน" width={114} height={104} preload unoptimized style={{ objectPosition: `${brand.x}% ${brand.y}%`, transform: `scale(${brand.zoom})` }} /> : <span className="brand-letter" aria-hidden="true"><PawPrint size={26} strokeWidth={2.2} /></span>}
        <div className="brand-name">{brand.name}</div>
        <div className="brand-subtitle">{brand.subtitle}</div>
      </div>

      <button className="sidebar-collapse" type="button" onClick={toggleCollapsed} aria-label={collapsed ? "ขยายเมนู" : "พับเมนู"} aria-expanded={!collapsed} title={collapsed ? "ขยายเมนู" : "พับเมนู"}>
        {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
      </button>
      <button className="sidebar-close" type="button" onClick={onClose} aria-label="ปิดเมนู"><X size={20} /></button>

      <nav className="sidebar-nav" aria-label="เมนูหลัก">
        {visibleNavigation.map(({ label, art, href }) => href === null ? (
          <div key={art} className="nav-item nav-placeholder" aria-disabled="true" title="ยังไม่เปิดใช้งาน">
            {art === "points" ? <span className="sidebar-clean-points" aria-hidden="true"><CustomerNavIcon tab="rewards" /></span> : <span className={`sidebar-picture sidebar-picture-${art}`} aria-hidden="true" />}
            <span className="sidebar-menu-copy"><strong>{label}</strong><span className="sidebar-mobile-label">{art === "reports" ? "รายงาน" : art === "rewards" ? "สิทธิพิเศษ" : art === "settings" ? "ตั้งค่า" : label}</span></span>
            <ChevronRight className="sidebar-menu-chevron" size={18} aria-hidden="true" />
          </div>
        ) : (
          <Link key={label} href={href} prefetch title={label} aria-label={label} aria-current={activePath === href ? "page" : undefined} className={`nav-item${activePath === href ? " active" : ""}`} onClick={() => onClose?.()} onMouseEnter={() => { router.prefetch(href); void prefetchCrmPage(href); }} onFocus={() => { router.prefetch(href); void prefetchCrmPage(href); }}>
            {art === "points" ? <span className="sidebar-clean-points" aria-hidden="true"><CustomerNavIcon tab="rewards" /></span> : <span className={`sidebar-picture sidebar-picture-${art}`} aria-hidden="true" />}
            <span className="sidebar-menu-copy"><strong>{label}</strong><span className="sidebar-mobile-label">{art === "reports" ? "รายงาน" : art === "rewards" ? "สิทธิพิเศษ" : art === "settings" ? "ตั้งค่า" : label}</span></span>
            <ChevronRight className="sidebar-menu-chevron" size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <div className="account-card">
        <div className="avatar">{role === "owner" ? "A" : role === "manager" ? "ผ" : "พ"}</div>
        <div>
          <strong>{role === "owner" ? "เจ้าของร้าน" : role === "manager" ? "ผู้ดูแลร้าน" : "พนักงาน"}</strong>
          <span>{brand.name || "Tammy Pet Shop"}</span>
        </div>
        <ChevronRight size={18} />
      </div>
      <Link className="logout" href="/login" onClick={() => { void supabase?.auth.signOut(); }}><LogOut size={19} /> ออกจากระบบ</Link>
    </aside>
  );
}
