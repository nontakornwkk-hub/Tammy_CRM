import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./card-design.css";
import "./popup-content.css";
import "./popup-source-list.css";
import "./popup-refresh.css";
import { AdminAuthGate } from "@/components/admin-auth-gate";

export const metadata: Metadata = {
  title: "Tammy Pet Shop CRM",
  description: "ระบบบริหารลูกค้า แต้ม คูปอง และของรางวัลสำหรับ Tammy Pet Shop",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body><AdminAuthGate>{children}</AdminAuthGate></body>
    </html>
  );
}
