import { ChevronRight, PawPrint } from "lucide-react";

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
  code: string;
  endsAt: string | null;
  theme?: string | null;
  onUse?: () => void;
};

export function CouponTicketFace({ discountType, discountValue, minSpend, code, endsAt, theme, onUse }: CouponTicketFaceProps) {
  const isPercent = discountType === "percent";
  const value = Number(discountValue).toLocaleString("th-TH");

  return <div className={`coupon-ticket coupon-ticket--${couponTheme(theme)}`}>
    <div className="coupon-ticket-main">
      <span className="coupon-ticket-kicker">คูปองส่วนลด</span>
      <strong className="coupon-ticket-value"><span>ลด</span><b>{value}</b><small>{isPercent ? "%" : "บาท"}</small></strong>
      <span className="coupon-ticket-min">{minSpend > 0 ? `เมื่อซื้อครบ ฿${Number(minSpend).toLocaleString("th-TH")}` : "ไม่มีขั้นต่ำ"}</span>
      <span className="coupon-ticket-dots" aria-hidden="true" />
      <PawPrint className="coupon-ticket-paw" size={23} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
    </div>
    <div className="coupon-ticket-stub">
      <span className="coupon-ticket-spark" aria-hidden="true"><i /><i /></span>
      <span className="coupon-ticket-code-label">รหัสคูปอง</span>
      <strong className="coupon-ticket-code">{code}</strong>
      <small>{endsAt ? `ใช้ได้ถึง ${new Date(endsAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" })}` : "ไม่กำหนดวันหมดอายุ"}</small>
      {onUse ? <button className="coupon-ticket-action" type="button" onClick={onUse}>ใช้คูปอง <ChevronRight size={16} /></button> : <span className="coupon-ticket-action" aria-hidden="true">ใช้คูปอง <ChevronRight size={16} /></span>}
    </div>
  </div>;
}
