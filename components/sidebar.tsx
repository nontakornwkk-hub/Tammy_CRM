"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadSettings } from "@/lib/settings";
import {
  BarChart3,
  ChevronRight,
  Gift,
  LogOut,
  Settings,
  Table2,
  Tags,
  Users,
} from "lucide-react";

const navigation = [
  { icon: Gift, label: "ให้แต้ม", href: "/points" },
  { icon: Users, label: "สมาชิก", href: "/members" },
  { icon: Table2, label: "ฐานข้อมูล", href: "/database" },
  { icon: Tags, label: "คูปองและของรางวัล", href: "/rewards" },
  { icon: BarChart3, label: "วิเคราะห์และรายงาน", href: "#" },
  { icon: Settings, label: "ตั้งค่าระบบ", href: "/settings" },
];

export function Sidebar({ activePath }: { activePath: "/points" | "/members" | "/database" | "/rewards" | "/settings" }) {
  const [brand, setBrand] = useState({ logo: "", name: "Tammy", subtitle: "Pet Shop CRM", x: 50, y: 50, zoom: 1 });

  useEffect(() => {
    const refresh = () => {
      const settings = loadSettings();
      setBrand({
        logo: settings.logoDataUrl,
        name: settings.shopName,
        subtitle: settings.shopNameEn,
        x: settings.logoPositionX,
        y: settings.logoPositionY,
        zoom: settings.logoZoom,
      });
    };
    refresh();
    window.addEventListener("tammy-settings-changed", refresh);
    return () => window.removeEventListener("tammy-settings-changed", refresh);
  }, []);

  return (
    <aside className="sidebar">
      <div className="brand">
        <Image src={brand.logo || "/assets/tammy-logo-cat.png"} alt="โลโก้ร้าน" width={114} height={104} preload unoptimized={Boolean(brand.logo)} style={{ objectPosition: `${brand.x}% ${brand.y}%`, transform: `scale(${brand.zoom})` }} />
        <div className="brand-name">{brand.name}</div>
        <div className="brand-subtitle">{brand.subtitle}</div>
      </div>

      <nav className="sidebar-nav" aria-label="เมนูหลัก">
        {navigation.map(({ icon: Icon, label, href }) => (
          <Link key={label} href={href} className={`nav-item${activePath === href ? " active" : ""}`}>
            <Icon size={22} strokeWidth={2} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-art" aria-hidden="true">
        <p>เพราะทุกความสุข<br />เริ่มต้นที่น้องแมว 🐾</p>
        <Image src="/assets/tammy-sidebar-cat.png" alt="" width={188} height={224} loading="eager" />
      </div>

      <div className="account-card">
        <div className="avatar">A</div>
        <div>
          <strong>Admin</strong>
          <span>ผู้ดูแลระบบ</span>
        </div>
        <ChevronRight size={18} />
      </div>
      <button className="logout" type="button"><LogOut size={19} /> ออกจากระบบ</button>
    </aside>
  );
}
