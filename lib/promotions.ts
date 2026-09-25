export type PointPromotion = {
  id: string;
  title: string;
  enabled: boolean;
  startsOn: string;
  endsOn: string;
  type: "multiplier" | "threshold" | "repeat" | "new_member" | "birthday";
  minSpend: number;
  multiplier: number;
  bonusPoints: number;
  stepSpend: number;
  newMemberDays?: number;
  themeHue?: number;
  themePattern?: number;
};

export const PROMOTION_PATTERN_COUNT = 5;

export function promotionPattern(promotion: PointPromotion, index = 0) {
  if (Number.isInteger(promotion.themePattern) && (promotion.themePattern ?? -1) >= 0 && (promotion.themePattern ?? 5) < PROMOTION_PATTERN_COUNT) return promotion.themePattern!;
  if (typeof promotion.themeHue === "number") {
    const hue = promotion.themeHue;
    if (hue >= 75 && hue < 175) return 1;
    if (hue >= 235 && hue < 310) return 2;
    if (hue >= 175 && hue < 235) return 3;
    if (hue >= 25 && hue < 75) return 4;
  }
  return index % PROMOTION_PATTERN_COUNT;
}

const PROMOTION_HUES = [8, 34, 52, 98, 150, 186, 218, 258, 292, 332];

export function promotionHue(promotion: PointPromotion, index = 0) {
  const hue = promotion.themeHue;
  return typeof hue === "number" && Number.isInteger(hue) && hue >= 0 && hue < 360
    ? hue
    : PROMOTION_HUES[index % PROMOTION_HUES.length];
}

export function randomPromotionHue(promotions: PointPromotion[], exceptId?: string) {
  const taken = promotions.filter((item) => item.id !== exceptId).map((item, index) => promotionHue(item, index));
  const available = PROMOTION_HUES.filter((hue) => taken.every((used) => Math.abs(hue - used) > 12));
  if (available.length) return available[Math.floor(Math.random() * available.length)];
  const remaining = Array.from({ length: 360 }, (_, hue) => hue).filter((hue) => !taken.includes(hue));
  if (!remaining.length) return Math.floor(Math.random() * 360);
  const distance = (hue: number) => Math.min(...taken.map((used) => {
    const gap = Math.abs(hue - used);
    return Math.min(gap, 360 - gap);
  }));
  const best = Math.max(...remaining.map(distance));
  const spaced = remaining.filter((hue) => distance(hue) >= best - 2);
  return spaced[Math.floor(Math.random() * spaced.length)];
}

export function bangkokToday() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function promotionBonus(promotion: PointPromotion, sale: number, basePoints: number) {
  if (sale < promotion.minSpend) return 0;
  if (promotion.type === "multiplier") return Math.floor(basePoints * Math.max(1, promotion.multiplier)) - basePoints;
  if (promotion.type === "threshold") return Math.max(0, promotion.bonusPoints);
  if (promotion.type === "new_member") return Math.max(0, promotion.bonusPoints);
  if (promotion.type === "birthday") return Math.max(0, promotion.bonusPoints);
  return promotion.stepSpend > 0 ? Math.floor(sale / promotion.stepSpend) * Math.max(0, promotion.bonusPoints) : 0;
}

export function calculateAward(sale: number, spend: number, earned: number, promotions: PointPromotion[], today = bangkokToday(), memberJoinedAt = "", birthDate = "", birthdayClaimed = false) {
  const base = spend > 0 ? Math.floor(sale / spend) * Math.max(0, earned) : 0;
  const eligible = promotions.filter((promotion) => {
    if (!promotion.enabled || sale < promotion.minSpend) return false;
    if (promotion.type === "birthday") return !!birthDate && birthDate.slice(5, 7) === today.slice(5, 7) && !birthdayClaimed;
    if (!promotion.startsOn || !promotion.endsOn || promotion.startsOn > today || promotion.endsOn < today) return false;
    if (promotion.type !== "new_member") return true;
    if (!memberJoinedAt) return false;
    const ageDays = (Date.parse(`${today}T12:00:00+07:00`) - new Date(memberJoinedAt).getTime()) / 86_400_000;
    return ageDays >= 0 && ageDays <= Math.max(1, promotion.newMemberDays ?? 30);
  });
  const best = eligible.map((promotion) => ({ promotion, bonus: promotionBonus(promotion, sale, base) })).sort((a, b) => b.bonus - a.bonus)[0];
  return { base, bonus: best?.bonus ?? 0, total: base + (best?.bonus ?? 0), promotion: best?.promotion ?? null };
}

export function promotionDescription(promotion: PointPromotion) {
  if (promotion.type === "multiplier") return `แต้มคูณ ${promotion.multiplier}`;
  if (promotion.type === "threshold") return `ซื้อครบ ${promotion.minSpend.toLocaleString()} บาท รับเพิ่ม ${promotion.bonusPoints} แต้ม`;
  if (promotion.type === "new_member") return `สมาชิกใหม่ภายใน ${promotion.newMemberDays ?? 30} วัน รับเพิ่ม ${promotion.bonusPoints} แต้ม`;
  if (promotion.type === "birthday") return `ซื้อในเดือนเกิด รับเพิ่ม ${promotion.bonusPoints} แต้ม · ปีละ 1 ครั้ง`;
  return `ทุก ${promotion.stepSpend.toLocaleString()} บาท รับเพิ่ม ${promotion.bonusPoints} แต้ม`;
}
