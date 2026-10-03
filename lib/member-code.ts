// Barcode readers act like keyboards. Use physical key positions first, then
// transliterate Thai Kedmanee text from paste or readers without KeyboardEvent.code.
const thaiToLatin = new Map<string, string>();
const keyboardRows: Array<[string, string]> = [
  ["1234567890", "ๅ/-ภถุึคตจ"],
  ["QWERTYUIOP", "ๆไำพะัีรนยบล"],
  ["ASDFGHJKL", "ฟหกดเ้่าส"],
  ["ZXCVBNM", "ผปแอิืท"],
  ["1234567890", "+๑๒๓๔ู฿๕๖๗"],
  ["QWERTYUIOP", "๐\"ฎฑธํ๊ณฯญ"],
  ["ASDFGHJKL", "ฤฆฏโฌ็๋ษศ"],
  ["ZXCVBNM", "ฉฮฺ์?ฒฬ"],
];
for (const [latin, thai] of keyboardRows) {
  Array.from(thai).forEach((letter, index) => thaiToLatin.set(letter, latin[index]));
}

export function memberScannerKey(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  return null;
}

export function normalizeMemberScan(raw: string): string {
  const unwrapped = raw.trim().replace(/^TAMMY-MEMBER:/i, "").normalize("NFKC");
  const thaiLayout = /[\u0E00-\u0E7F]/.test(unwrapped);
  const compact = Array.from(unwrapped)
    .map((letter) => thaiLayout ? thaiToLatin.get(letter) ?? letter : letter)
    .join("").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.replace(/^TAMMY(?:3)?MEMBER/, "");
}

export function normalizeCouponScan(raw: string): string | null {
  const converted = Array.from(raw.trim().normalize("NFKC"))
    .map((letter) => /[\u0E00-\u0E7F]/.test(letter) ? thaiToLatin.get(letter) ?? letter : letter).join("").toUpperCase();
  const isTest = converted.includes("TAMMY-TEST-COUPON");
  const withoutPrefix = converted.replace(/^.*?TAMMY[^A-Z0-9]*(?:TEST[^A-Z0-9]*)?COUPON[^A-Z0-9]*/, "");
  const hex = withoutPrefix.replace(/[^A-F0-9]/g, "");
  if (hex.length !== 32) return null;
  return `${isTest ? "TAMMY-TEST-COUPON" : "TAMMY-COUPON"}:${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function normalizeGameScan(raw: string): string | null {
  const converted=Array.from(raw.trim().normalize("NFKC")).map(letter=>/[\u0E00-\u0E7F]/.test(letter)?thaiToLatin.get(letter)??letter:letter).join("").toUpperCase();
  if(!/^TAMMY[^A-Z0-9]*GAME[^A-Z0-9]+/.test(converted))return null;
  const hex=converted.replace(/^TAMMY[^A-Z0-9]*GAME[^A-Z0-9]+/,"").replace(/[^A-F0-9]/g,"");
  if(hex.length!==32)return null;
  return `TAMMY-GAME:${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
