import type { PointPromotion } from "./promotions";
import { defaultPopupContent, normalizePopupContent, type PopupContent } from "./popup-content";
import { defaultCardDesign, normalizeCardDesign, type CardMascot, type CardTheme } from "./card-design";

export type ContactPlatform = "line" | "facebook" | "instagram" | "tiktok" | "youtube" | "phone" | "website";

export type StoreContact = {
  id: number;
  platform: ContactPlatform;
  label: string;
  value: string;
  url: string;
  active: boolean;
};
export type ShopDay = { day: string; open: boolean; opensAt: string; closesAt: string };
export type TemporaryClosure = { enabled: boolean; startsOn: string; endsOn: string; reopensOn: string; reason: string };
export const WEEKDAYS = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
export const defaultWeeklyHours: ShopDay[] = WEEKDAYS.map(day => ({ day, open: true, opensAt: "08:00", closesAt: "20:30" }));

export type AppSettings = {
  shopName: string;
  shopNameEn: string;
  description: string;
  welcomeMessage: string;
  logoDataUrl: string;
  logoPositionX: number;
  logoPositionY: number;
  logoZoom: number;
  customerUrl: string;
  weeklyHours: ShopDay[];
  temporaryClosure: TemporaryClosure;
  contacts: StoreContact[];
  storeHoursEnabled: boolean;
  storeDays: string;
  storeOpenTime: string;
  storeCloseTime: string;
  primaryColor: string;
  pointsSpend: number;
  pointsEarned: number;
  goldMinSpend: number;
  platinumMinSpend: number;
  goldBahtPerPoint: number;
  platinumBahtPerPoint: number;
  goldUpgradeBonus: number;
  platinumUpgradeBonus: number;
  welcomeBonusEnabled: boolean;
  welcomeBonusPoints: number;
  promotionMultiplier: number;
  promotions: PointPromotion[];
  pointsExpiration: string;
  accumulationEnabled: boolean;
  popupEnabled: boolean;
  popupContent: PopupContent[];
  inStoreEnabled: boolean;
  requireRedemptionApproval: boolean;
  displayCustomization: boolean;
  selectedTheme: string;
  selectedMascot: string;
  cardThemes: CardTheme[];
  cardMascots: CardMascot[];
  twoFactorEnabled: boolean;
  loginAlertsEnabled: boolean;
  autoLogoutEnabled: boolean;
  autoLogoutMinutes: number;
};

export const SETTINGS_KEY = "tammy-crm-settings-v1";

export const defaultSettings: AppSettings = {
  shopName: "แทมมี่อาหารสัตว์",
  shopNameEn: "Tammy Pet Shop",
  description: "ร้านอาหารสัตว์ ของเล่น และอุปกรณ์สำหรับสัตว์เลี้ยง คัดสรรคุณภาพดี เพื่อสัตว์เลี้ยงที่คุณรัก",
  welcomeMessage: "ยินดีต้อนรับสู่แทมมี่อาหารสัตว์ สะสมแต้มง่าย แลกของรางวัลมากมายสำหรับน้อง ๆ",
  logoDataUrl: "",
  logoPositionX: 50,
  logoPositionY: 50,
  logoZoom: 1,
  customerUrl: "",
  weeklyHours: defaultWeeklyHours,
  temporaryClosure: { enabled: false, startsOn: "", endsOn: "", reopensOn: "", reason: "" },
  contacts: [
    { id: 1, platform: "line", label: "LINE Official Account", value: "@tammypetshop", url: "https://line.me/R/ti/p/@tammypetshop", active: true },
    { id: 2, platform: "facebook", label: "Facebook Page", value: "Tammy Pet Shop", url: "https://facebook.com/", active: true },
    { id: 3, platform: "tiktok", label: "TikTok", value: "@tammypetshop", url: "https://www.tiktok.com/@tammypetshop", active: true },
    { id: 4, platform: "phone", label: "เบอร์โทรศัพท์", value: "02-123-4567", url: "tel:021234567", active: false },
  ],
  storeHoursEnabled: true,
  storeDays: "ทุกวัน",
  storeOpenTime: "08:00",
  storeCloseTime: "20:30",
  primaryColor: "#ff554b",
  pointsSpend: 50,
  pointsEarned: 1,
  goldMinSpend: 5000,
  platinumMinSpend: 20000,
  goldBahtPerPoint: 45,
  platinumBahtPerPoint: 40,
  goldUpgradeBonus: 15,
  platinumUpgradeBonus: 30,
  welcomeBonusEnabled: false,
  welcomeBonusPoints: 10,
  promotionMultiplier: 1,
  promotions: [],
  pointsExpiration: "ไม่มีวันหมดอายุ",
  accumulationEnabled: true,
  popupEnabled: true,
  popupContent: defaultPopupContent,
  inStoreEnabled: true,
  requireRedemptionApproval: true,
  displayCustomization: false,
  selectedTheme: "Coral Sunset",
  selectedMascot: "Tammy Cat",
  cardThemes: defaultCardDesign.themes,
  cardMascots: defaultCardDesign.mascots,
  twoFactorEnabled: false,
  loginAlertsEnabled: true,
  autoLogoutEnabled: true,
  autoLogoutMinutes: 15,
};

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const value = window.localStorage.getItem(SETTINGS_KEY);
    if (!value) return defaultSettings;
    const parsed = JSON.parse(value) as Partial<AppSettings>;
    const contacts = (parsed.contacts ?? defaultSettings.contacts).map((contact, index) => {
      const legacy = contact as Partial<StoreContact>;
      const platform = legacy.platform ?? inferPlatform(legacy.label ?? "");
      return {
        id: legacy.id ?? Date.now() + index,
        platform,
        label: legacy.label ?? "ช่องทางติดต่อ",
        value: legacy.value ?? "",
        url: legacy.url ?? inferUrl(platform, legacy.value ?? ""),
        active: legacy.active ?? true,
      };
    });
    const card = normalizeCardDesign({ themes: parsed.cardThemes, mascots: parsed.cardMascots, selectedTheme: parsed.selectedTheme, selectedMascot: parsed.selectedMascot, displayCustomization: parsed.displayCustomization });
    return { ...defaultSettings, ...parsed, cardThemes: card.themes, cardMascots: card.mascots, selectedTheme: card.selectedTheme, selectedMascot: card.selectedMascot, contacts, weeklyHours: Array.isArray(parsed.weeklyHours) ? parsed.weeklyHours : defaultWeeklyHours, temporaryClosure: { ...defaultSettings.temporaryClosure, ...parsed.temporaryClosure }, promotions: Array.isArray(parsed.promotions) ? parsed.promotions : [], popupContent: normalizePopupContent(parsed.popupContent) };
  } catch {
    return defaultSettings;
  }
}

function inferPlatform(label: string): ContactPlatform {
  const normalized = label.toLowerCase();
  if (normalized.includes("line")) return "line";
  if (normalized.includes("facebook")) return "facebook";
  if (normalized.includes("instagram")) return "instagram";
  if (normalized.includes("tiktok")) return "tiktok";
  if (normalized.includes("youtube")) return "youtube";
  if (normalized.includes("โทร")) return "phone";
  return "website";
}

function inferUrl(platform: ContactPlatform, value: string) {
  if (platform === "phone") return `tel:${value.replace(/[^\d+]/g, "")}`;
  return "";
}

export function saveSettings(settings: AppSettings) {
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("tammy-settings-changed", { detail: settings }));
}
