import { GAME_COLORS, isSupportedEngine } from "./registry";
import type { AdminPrize, GameSetup, PublicPrize } from "./types";
export function defaultGameSetup(): GameSetup {
  return { program: { purchaseThreshold: 500, earningEnabled: false }, game: { id: "", key: "paw-wheel", engine: "wheel", name: "วงล้ออุ้งเท้า", difficulty: "easy", enabled: false, version: 0, prizes: [2, 5, 10].map((points, index) => ({ ...newPrize(), id: `starter-${index}`, title: `${points} แต้ม`, points, weight: [40, 35, 25][index], color: GAME_COLORS[index] })) } };
}
export function newPrize(): AdminPrize {
  return { id: "", title: "รางวัลใหม่", kind: "points", image: "", color: GAME_COLORS[0], points: 2, weight: 0, stock: null, active: true, discountType: "percent", discountValue: 5, minSpend: 0, maxDiscount: null, expiryMode: "hours", expiryHours: 168, expiresAt: null };
}
export function publicPrize(prize: PublicPrize): PublicPrize {
  // Explicit allowlist: never spread an administrative row into member output.
  return { id: prize.id, title: prize.kind === "points" && /^(?:[\d,]+\s*แต้ม|รางวัลใหม่)$/.test(prize.title.trim()) ? `${prize.points} แต้ม` : prize.title, kind: prize.kind, image: prize.image, color: prize.color, points: prize.points, discountType: prize.discountType, discountValue: prize.discountValue, minSpend: prize.minSpend, maxDiscount: prize.maxDiscount, expiryMode: prize.expiryMode, expiryHours: prize.expiryHours, expiresAt: prize.expiresAt };
}
export function validateSetup(value: unknown): asserts value is GameSetup {
  if (!value || typeof value !== "object") throw new Error("การตั้งค่าไม่ถูกต้อง");
  const setup = value as GameSetup;
  if (!setup.program || !Number.isFinite(setup.program.purchaseThreshold) || setup.program.purchaseThreshold < 1 || setup.program.purchaseThreshold > 1000000 || typeof setup.program.earningEnabled !== "boolean") throw new Error("กำหนดยอดซื้อ 1–1,000,000 บาท");
  const game = setup.game;
  if (!game || !/^[a-z][a-z0-9-]{2,49}$/.test(game.key) || !isSupportedEngine(game.engine) || typeof game.enabled !== "boolean" || typeof game.name !== "string" || !game.name.trim() || game.name.length > 80 || !Number.isInteger(game.version) || game.version < 0 || !Array.isArray(game.prizes) || game.prizes.length < 2 || game.prizes.length > 16) throw new Error("กำหนดชื่อเกมและช่องรางวัล 2–16 ช่อง");
  let sum = 0; const ids = new Set<string>();
  for (const p of game.prizes) {
    if (typeof p.id !== "string" || ids.has(p.id)) throw new Error("ช่องรางวัลซ้ำ"); ids.add(p.id);
    if (!["points", "coupon", "item"].includes(p.kind) || typeof p.title !== "string" || !p.title.trim() || p.title.length > 100 || typeof p.active !== "boolean" || !Number.isFinite(p.weight) || p.weight < 0 || p.weight > 100000 || Math.abs(p.weight * 100 - Math.round(p.weight * 100)) > 0.00001) throw new Error("กำหนดชื่อและเรทการออก 0–100,000 (ทศนิยมไม่เกิน 2 ตำแหน่ง)");
    if (p.stock !== null && (!Number.isInteger(p.stock) || p.stock < 0 || p.stock > 1000000)) throw new Error("จำนวนสต็อกไม่ถูกต้อง");
    if (!/^#[0-9a-f]{6}$/i.test(p.color) || typeof p.image !== "string" || (p.image && !/^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(p.image)) || p.image.length > 300000) throw new Error("รูปภาพหรือสีรางวัลไม่ถูกต้อง");
    if (p.kind === "points" && (!Number.isInteger(p.points) || p.points < 1 || p.points > 100000)) throw new Error("แต้มรางวัลต้องเป็นจำนวนเต็ม 1–100,000");
    if (p.kind === "coupon" && (!["percent", "fixed"].includes(p.discountType) || !Number.isFinite(p.discountValue) || p.discountValue <= 0 || p.discountValue > (p.discountType === "percent" ? 100 : 100000) || !Number.isFinite(p.minSpend) || p.minSpend < 0 || (p.maxDiscount !== null && (!Number.isFinite(p.maxDiscount) || p.maxDiscount <= 0)))) throw new Error("เงื่อนไขส่วนลดไม่ถูกต้อง");
    if (p.kind !== "points" && (p.expiryMode === "hours" ? !Number.isInteger(p.expiryHours) || p.expiryHours < 1 || p.expiryHours > 8760 : p.expiryMode !== "fixed" || !p.expiresAt || !Number.isFinite(Date.parse(p.expiresAt)) || Date.parse(p.expiresAt) <= Date.now())) throw new Error("กำหนดอายุรางวัลหรือวันหมดอายุในอนาคต");
    if (p.active) sum += Math.round(p.weight * 100);
  }
  if (sum <= 0) throw new Error("เปิดอย่างน้อยหนึ่งช่องที่มีเรทการออกมากกว่า 0");
}

// One eligibility rule for the admin preview and member status. Array order is preserved.
export function playablePrizes(prizes: AdminPrize[], now=Date.now()): PublicPrize[] {
  return prizes.filter(p=>p.active && p.weight>0 && (p.stock===null || p.stock>0) && (p.kind==="points" || p.expiryMode==="hours" || Date.parse(p.expiresAt||"")>now)).map(publicPrize);
}
export function shufflePrizes<T>(values: readonly T[]): T[] {
  const shuffled=[...values];
  for(let i=shuffled.length-1;i>0;i--){const draw=new Uint32Array(1);crypto.getRandomValues(draw);const j=draw[0]%(i+1);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  if(shuffled.length>1 && shuffled.every((value,i)=>value===values[i]))shuffled.push(shuffled.shift()!);
  return shuffled;
}
