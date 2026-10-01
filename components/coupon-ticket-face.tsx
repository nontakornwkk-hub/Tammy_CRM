import { ChevronRight, PawPrint, TicketPercent } from "lucide-react";

export const couponThemes = [
  { id: "coral", label: "พีชคอรัล" },
  { id: "honey", label: "เหลืองน้ำผึ้ง" },
  { id: "rose", label: "ชมพูโรส" },
] as const;

export type CouponTheme = (typeof couponThemes)[number]["id"];

export function couponTheme(value: string | null | undefined): CouponTheme {
  return couponThemes.find((theme) => theme.id === value)?.id ?? "coral";
}

type CouponTicketFaceProps = {
  discountType: string;
  discountValue: number;
  minSpend: number;
  endsAt: string | null;
  remaining?: number | null;
  theme?: string | null;
  onUse?: () => void;
};

export function CouponTicketFace({ discountType, discountValue, minSpend, endsAt, remaining = null, theme, onUse }: CouponTicketFaceProps) {
  const isPercent = discountType === "percent";
  const value = Number(discountValue).toLocaleString("th-TH");

  return <div className={`coupon-ticket coupon-ticket--${couponTheme(theme)}`}>
    <div className="coupon-ticket-main">
      <div className="coupon-ticket-top"><span className="coupon-ticket-kicker"><TicketPercent size={13} /> คูปองส่วนลด</span><span className="coupon-ticket-member">สำหรับสมาชิก</span></div>
      <strong className="coupon-ticket-value"><span>ลด</span><b>{value}</b><small>{isPercent ? "%" : "บาท"}</small></strong>
      <span className="coupon-ticket-min">{minSpend > 0 ? `เมื่อซื้อครบ ฿${Number(minSpend).toLocaleString("th-TH")}` : "ใช้ได้โดยไม่มีขั้นต่ำ"}</span>
      <span className="coupon-ticket-dots" aria-hidden="true" />
      <PawPrint className="coupon-ticket-paw" size={19} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
    </div>
    <div className="coupon-ticket-stub">
      <span className="coupon-ticket-stub-title">สิทธิ์คงเหลือ</span>
      <strong className="coupon-ticket-remaining">{remaining === null ? "ไม่จำกัด" : `${Math.max(0, remaining).toLocaleString("th-TH")} สิทธิ์`}</strong>
      <small className="coupon-ticket-expiry">{endsAt ? `ถึง ${new Date(endsAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" })}` : "ไม่กำหนดวันหมดอายุ"}</small>
      {onUse ? <button className="coupon-ticket-action" type="button" onClick={onUse}>ใช้คูปอง <ChevronRight size={16} /></button> : <span className="coupon-ticket-action" aria-hidden="true">ใช้ที่หน้าร้าน <ChevronRight size={16} /></span>}
    </div>
  </div>;
}
