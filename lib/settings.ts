export type ContactPlatform = "line" | "facebook" | "instagram" | "tiktok" | "youtube" | "phone" | "website";

export type StoreContact = {
  id: number;
  platform: ContactPlatform;
  label: string;
  value: string;
  url: string;
  active: boolean;
};

export type AppSettings = {
  shopName: string;
  shopNameEn: string;
  description: string;
  welcomeMessage: string;
  logoDataUrl: string;
  logoPositionX: number;
  logoPositionY: number;
  logoZoom: number;
  heroDataUrl: string;
  heroPositionX: number;
  heroPositionY: number;
  heroZoom: number;
  contacts: StoreContact[];
  storeHoursEnabled: boolean;
  storeDays: string;
  storeOpenTime: string;
  storeCloseTime: string;
  primaryColor: string;
  pointsSpend: number;
  pointsEarned: number;
  promotionMultiplier: number;
  pointsExpiration: string;
  accumulationEnabled: boolean;
  popupEnabled: boolean;
  inStoreEnabled: boolean;
  requireRedemptionApproval: boolean;
  displayCustomization: boolean;
  selectedTheme: string;
  selectedMascot: string;
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
  heroDataUrl: "",
  heroPositionX: 50,
  heroPositionY: 50,
  heroZoom: 1,
  contacts: [
    { id: 1, platform: "line", label: "LINE Official Account", value: "@tammypetshop", url: "https://line.me/R/ti/p/@tammypetshop", active: true },
    { id: 2, platform: "facebook", label: "Facebook Page", value: "Tammy Pet Shop", url: "https://facebook.com/", active: true },
    { id: 3, platform: "tiktok", label: "TikTok", value: "@tammypetshop", url: "https://www.tiktok.com/@tammypetshop", active: true },
    { id: 4, platform: "phone", label: "เบอร์โทรศัพท์", value: "02-123-4567", url: "tel:021234567", active: false },
  ],
  storeHoursEnabled: true,
  storeDays: "ทุกวัน",
  storeOpenTime: "09:00",
  storeCloseTime: "20:00",
  primaryColor: "#ff554b",
  pointsSpend: 50,
  pointsEarned: 1,
  promotionMultiplier: 2,
  pointsExpiration: "ไม่มีวันหมดอายุ",
  accumulationEnabled: true,
  popupEnabled: true,
  inStoreEnabled: true,
  requireRedemptionApproval: true,
  displayCustomization: true,
  selectedTheme: "Coral Sunset",
  selectedMascot: "Tammy Cat",
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
    return { ...defaultSettings, ...parsed, contacts };
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
