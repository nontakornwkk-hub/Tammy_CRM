import { Store } from "lucide-react";
export const couponThemes = [
  { id: "coral", label: "พีช" }, { id: "mint", label: "มิ้นต์" },
  { id: "rose", label: "โรส" }, { id: "lavender", label: "ลาเวนเดอร์" }, { id: "honey", label: "น้ำผึ้ง" },
] as const;
export type CouponTheme = (typeof couponThemes)[number]["id"];
export function couponTheme(value: string | null | undefined): CouponTheme { return couponThemes.find(theme => theme.id === value)?.id ?? "coral"; }
type Props = { title?: string; description?: string; discountType: string; discountValue: number; minSpend: number; endsAt: string | null; remaining?: number | null; theme?: string | null; onUse?: () => void; variant?: "default" | "member" };
export function CouponTicketFace({title, description, discountType, discountValue, minSpend, endsAt, remaining = null, theme, onUse}: Props) {
  const percent = discountType === "percent";
  const exhausted = remaining !== null && remaining <= 0;
  const action = <><Store size={16} aria-hidden="true" /><span>{exhausted ? "สิทธิ์หมดแล้ว" : "ใช้ที่หน้าร้าน"}</span></>;
  return <div className={`coupon-pastel-ticket coupon-pastel-ticket--${couponTheme(theme)}`}>
    <div className="coupon-pastel-offer"><span>ส่วนลด</span><strong>{Number(discountValue).toLocaleString("th-TH")}{percent && <small>%</small>}</strong>{!percent && <b>บาท</b>}</div>
    <div className="coupon-pastel-copy"><h2>{title || (percent ? "ลดทุกสินค้า" : `เมื่อซื้อครบ ${Number(minSpend).toLocaleString("th-TH")} บาท`)}</h2><p>{minSpend > 0 ? `เมื่อซื้อครบ ${Number(minSpend).toLocaleString("th-TH")} บาท` : "ไม่มีขั้นต่ำ"}</p>{description && <p className="coupon-pastel-description">{description}</p>}<small>{endsAt ? `ใช้ได้ถึง ${new Date(endsAt).toLocaleDateString("th-TH", { day:"numeric",month:"short",year:"numeric",timeZone:"Asia/Bangkok" })}` : "ไม่กำหนดวันหมดอายุ"}</small><div className="coupon-pastel-bottom"><span className="coupon-pastel-rights">{remaining === null ? "สิทธิ์ไม่จำกัด" : `เหลือ ${Math.max(0,remaining).toLocaleString("th-TH")} สิทธิ์`}</span>{onUse ? <button type="button" disabled={exhausted} className="coupon-pastel-action" aria-label={`ใช้คูปอง ${title || "ส่วนลด"} ที่หน้าร้าน`} onClick={onUse}>{action}</button> : <span className="coupon-pastel-action coupon-pastel-action-preview">{action}</span>}</div></div>
  </div>;
}
