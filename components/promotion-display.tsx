import { Bone, Heart, PawPrint, Sparkles } from "lucide-react";
import type { PointPromotion } from "@/lib/promotions";
import { promotionDescription, promotionPattern } from "@/lib/promotions";

function shortPromotionDescription(promotion: PointPromotion) {
  if (promotion.type === "multiplier") return `แต้มคูณ ${promotion.multiplier}`;
  if (promotion.type === "threshold") return `ครบ ${promotion.minSpend.toLocaleString()} บาท +${promotion.bonusPoints} แต้ม`;
  if (promotion.type === "new_member") return `สมาชิกใหม่ +${promotion.bonusPoints} แต้ม`;
  if (promotion.type === "birthday") return `เดือนเกิด +${promotion.bonusPoints} แต้ม`;
  return `ทุก ${promotion.stepSpend.toLocaleString()} บาท +${promotion.bonusPoints} แต้ม`;
}

export function PromotionDisplay({ promotion, index = 0 }: { promotion: PointPromotion; index?: number }) {
  const pattern = promotionPattern(promotion, index);
  const title = promotion.title.trim() || "โปรโมชั่นให้แต้ม";
  const description = shortPromotionDescription(promotion);
  const fullDescription = promotionDescription(promotion);

  return (
    <div className={`promotion-display promotion-pattern-${pattern}`} aria-label={`${title} · ${fullDescription}`}>
      <span className="promotion-display-art" aria-hidden="true">{pattern === 1 || pattern === 3 ? <Bone /> : pattern === 2 ? <Heart /> : pattern === 4 ? <Sparkles /> : <PawPrint />}</span>
      <span className="promotion-display-copy"><strong>{title}</strong><small>{description}</small></span>
      <span className="promotion-display-doodles" aria-hidden="true"><PawPrint /><Sparkles /><Heart /></span>
    </div>
  );
}
