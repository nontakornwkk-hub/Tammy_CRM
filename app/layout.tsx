import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tammy Pet Shop CRM",
  description: "ระบบบริหารลูกค้า แต้ม คูปอง และของรางวัลสำหรับ Tammy Pet Shop",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
