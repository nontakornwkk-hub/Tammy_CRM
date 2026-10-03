import type { PublicPrize } from "./types";
// A separate, uniform practice game. No production odds enter the member bundle.
export const practicePrizes: PublicPrize[] = [
  ["coins", "5 แต้ม", "points", "#0865e9", 5],
  ["coupon", "ส่วนลด 10%", "coupon", "#009f65", 0],
  ["food", "อาหารน้องแมว", "item", "#f58a18", 0],
  ["bonus", "10 แต้ม", "points", "#0865e9", 10],
  ["gift", "ของขวัญน้องหมา", "item", "#009f65", 0],
  ["treat", "ขนมสัตว์เลี้ยง", "item", "#f58a18", 0],
].map(([id, title, kind, color, points]) => ({ id: String(id), title: String(title), kind: kind as PublicPrize["kind"], color: String(color), points: Number(points), image: "", discountType: "percent", discountValue: 10, minSpend: 0, maxDiscount: null, expiryMode: "hours", expiryHours: 168, expiresAt: null }));
