import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./card-design.css";
import "./popup-content.css";
import "./popup-source-list.css";
import "./popup-refresh.css";
import "./responsive.css";
import "./customer-home.css";
import "./customer-account.css";
import "./customer-reference.css";
import "./coupon-customer-refresh.css";
import "./customer-reward-detail.css";
import "./coupon-ticket.css";
import "./customer-catalog-refresh.css";
import "./sidebar-reference.css";
import "./line-manager.css";
import "./line-coupon-campaign.css";
import "./line-inbox.css";
import "./line-membership.css";
import "./customer-design-refresh.css";
import "./line-entry.css";
import "./admin-motion.css";
import "./rank-colors.css";
import "./pos-connection.css";
import "./settings-readability.css";
import "./ui-polish.css";
import "./coupon-ticket-redesign.css";
import "./reward-redemption-dock.css";
import "./line-member-transfer.css";
import "./customer-test-mode.css";
import "./customer-account-polish.css";
import "./coupon-analytics.css";
import "./customer-premium.css";
import "./customer-soft.css";
import "./coupon-pastel.css";
import "./member-metallic.css";
import "./device-layout.css";
import "./customer-navigation.css";
import "./transaction-history.css";
import "./connections-settings.css";
import "./games.css";
import "./games-admin-polish.css";
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
