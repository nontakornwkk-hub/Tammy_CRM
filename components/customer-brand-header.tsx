import Image from "next/image";
import { PawPrint, UserRound } from "lucide-react";

export function CustomerBrandHeader({ greeting, pictureUrl, logoUrl }: { greeting: string; pictureUrl?: string | null; logoUrl?: string | null; shopName?: string }) {
  return <header className="customer-home-header">
    <div className="customer-home-brand">
      {logoUrl ? <Image src={logoUrl} alt="โลโก้ร้าน" width={42} height={42} unoptimized /> : <PawPrint className="customer-brand-mark" size={27} aria-hidden="true" />}
    </div>
    <div className="customer-home-greeting"><div><span>สวัสดี</span><strong>{greeting.replace(/^สวัสดี\s*/, "")}</strong></div><span className="customer-header-avatar">{pictureUrl ? <Image src={pictureUrl} alt="รูปโปรไฟล์ LINE ของคุณ" width={40} height={40} unoptimized /> : <UserRound size={22} aria-hidden="true" />}</span></div>
  </header>;
}
