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
  const originalWords = title === "โปรโมชั่นใหม่" && description === "แต้มคูณ 1.25";

  return (
    <div className={`promotion-display promotion-pattern-${pattern}${pattern < 3 ? " promotion-display-reference" : ""}`} aria-label={`${title} · ${fullDescription}`}>
      {pattern < 3 ? (
        originalWords ? <span className="sr-only">{title} · {description}</span> :
          <span className="promotion-display-copy promotion-display-copy-overprint"><strong>{title}</strong><small>{description}</small></span>
      ) : <>
        <span className="promotion-display-art" aria-hidden="true">{pattern === 3 ? <Bone /> : <Sparkles />}</span>
        <span className="promotion-display-copy"><strong>{title}</strong><small>{description}</small></span>
        <svg className="promotion-display-trail" viewBox="0 0 500 95" preserveAspectRatio="none" fill="none" aria-hidden="true"><path d="M0 55 C80 100 120 5 215 58 S350 5 500 55" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray={pattern === 3 ? "8 11" : undefined} /></svg>
        <span className="promotion-display-decor decor-one" aria-hidden="true"><PawPrint /></span>
        <span className="promotion-display-decor decor-two" aria-hidden="true">{pattern === 3 ? <Bone /> : <Sparkles />}</span>
        <span className="promotion-display-decor decor-three" aria-hidden="true"><Heart /></span>
        <span className="promotion-display-decor decor-four" aria-hidden="true"><Sparkles /></span>
      </>}
    </div>
  );
}
