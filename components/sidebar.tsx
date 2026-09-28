"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadSettings } from "@/lib/settings";
import { supabase } from "@/lib/supabase/client";
import { crmRole, prefetchCrmPage } from "@/lib/supabase/crm-data";
import {
  BarChart3,
  ChevronRight,
  Gift,
  LogOut,
  Settings,
  Smartphone,
  Tags,
  Users,
} from "lucide-react";

const navigation = [
  { icon: Gift, label: "ให้แต้ม", detail: "เพิ่ม / ลดแต้มสมาชิก", art: "points", href: "/points" },
  { icon: Users, label: "สมาชิก", detail: "จัดการข้อมูลสมาชิก", art: "members", href: "/members" },
  { icon: BarChart3, label: "แดชบอร์ดวิเคราะห์", detail: "สรุปยอดและรายงาน", art: "reports", href: "/reports" },
  { icon: Tags, label: "ของรางวัล คูปอง และข่าวสาร", detail: "จัดการของรางวัล คูปอง โปรโมชั่น", art: "rewards", href: "/rewards" },
  { icon: Gift, label: "ลุ้นของรางวัล", detail: "ตั้งค่ากิจกรรมลุ้นรางวัล", art: "lucky", href: null },
  { icon: Gift, label: "LINE", detail: "เชื่อมต่อและตั้งค่า LINE", art: "line", href: "/line" },
  { icon: Settings, label: "ตั้งค่าระบบ", detail: "จัดการระบบและสิทธิ์ผู้ใช้", art: "settings", href: "/settings" },
  { icon: Smartphone, label: "หน้าสำหรับลูกค้า", detail: "ดูหน้าร้านสำหรับสมาชิก", art: "preview", href: "/customer-preview" },
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

export function Sidebar({ activePath }: { activePath: "/points" | "/members" | "/rewards" | "/settings" | "/reports" | "/customer-preview" | "/line" }) {
  const [brand, setBrand] = useState<Brand>(() => cachedBrand ?? defaultBrand);
  const role = crmRole();
  const visibleNavigation = navigation.filter(({ href }) => role === "owner" || role === "manager" || role === "staff" && (href === "/points" || href === "/settings" || href === "/line"));

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
    <aside className="sidebar sidebar-reference">
      <div className="brand">
        <Image src={brand.logo || "/assets/tammy-logo-cat.png"} alt="โลโก้ร้าน" width={114} height={104} preload unoptimized={Boolean(brand.logo)} style={{ objectPosition: `${brand.x}% ${brand.y}%`, transform: `scale(${brand.zoom})` }} />
        <div className="brand-name">{brand.name}</div>
        <div className="brand-subtitle">{brand.subtitle}</div>
      </div>

      <nav className="sidebar-nav" aria-label="เมนูหลัก">
        {visibleNavigation.map(({ icon: Icon, label, detail, art, href }) => href === null ? (
          <div key={art} className="nav-item nav-placeholder" aria-disabled="true" title="ยังไม่เปิดใช้งาน">
            <span className={`sidebar-picture sidebar-picture-${art}`} aria-hidden="true" />
            <span className="sidebar-menu-copy"><strong>{label}</strong><small>{detail}</small></span>
            <ChevronRight className="sidebar-menu-chevron" size={18} aria-hidden="true" />
          </div>
        ) : (
          <Link key={label} href={href} title={label} aria-current={activePath === href ? "page" : undefined} className={`nav-item${activePath === href ? " active" : ""}`} onMouseEnter={() => prefetchCrmPage(href)} onFocus={() => prefetchCrmPage(href)}>
            <span className={`sidebar-picture sidebar-picture-${art}`} aria-hidden="true">{art === "preview" && <Icon size={30} />}</span>
            <span className="sidebar-menu-copy"><strong>{label}</strong><small>{detail}</small></span>
            <ChevronRight className="sidebar-menu-chevron" size={18} aria-hidden="true" />
          </Link>
        ))}
      </nav>

      <div className="sidebar-art" aria-hidden="true">
        <p>เพราะทุกความสุข<br />เริ่มต้นที่น้องแมว 🐾</p>
        <Image src="/assets/member-mascot-cat.png" alt="" width={188} height={224} loading="eager" />
      </div>

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
