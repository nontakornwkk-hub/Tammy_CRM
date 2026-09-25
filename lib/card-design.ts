export const cardPatterns = ["paws", "fish", "kibble", "stitch", "bones"] as const;
export type CardPattern = typeof cardPatterns[number];
export type CardTheme = { id: string; name: string; from: string; to: string; ink: string; base?: string; pattern?: CardPattern };
export type CardMascot = { id: string; name: string; image: string };
export type CardDesign = {
  themes: CardTheme[];
  mascots: CardMascot[];
  selectedTheme: string;
  selectedMascot: string;
  displayCustomization: boolean;
};

export const defaultCardThemes: CardTheme[] = [
  { id: "Coral Sunset", name: "คอรัล", base: "#eb8177", from: "#ffd6ce", to: "#fff4ec", ink: "#56312d", pattern: "paws" },
  { id: "Mint Garden", name: "มิ้นต์", base: "#75bda5", from: "#d1efe2", to: "#f3fbf5", ink: "#285448", pattern: "fish" },
  { id: "Sky Blue", name: "ฟ้า", base: "#79a9df", from: "#d6e8ff", to: "#f5faff", ink: "#2b4b70", pattern: "kibble" },
  { id: "Lavender Dream", name: "ลาเวนเดอร์", base: "#aa8bd8", from: "#e8ddf8", to: "#fcf8ff", ink: "#4c3a68", pattern: "stitch" },
  { id: "Honey Gold", name: "ฮันนี่โกลด์", base: "#d7a64f", from: "#ffebbb", to: "#fff9e9", ink: "#674d25", pattern: "bones" },
];

const defaultPatternById: Record<string, CardPattern> = {
  "Coral Sunset": "paws", "Mint Garden": "fish", "Sky Blue": "kibble",
  "Lavender Dream": "stitch", "Honey Gold": "bones",
};

export function patternForTheme(theme: CardTheme): CardPattern {
  return cardPatterns.find((pattern) => pattern === theme.pattern) ?? defaultPatternById[theme.id] ?? "paws";
}

function mixHex(color: string, target: number, portion: number) {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color.slice(1) : "eb8177";
  return `#${[0, 2, 4].map((offset) => Math.round(parseInt(hex.slice(offset, offset + 2), 16) * (1 - portion) + target * portion).toString(16).padStart(2, "0")).join("")}`;
}

export function paletteFromTone(base: string) {
  return { base, from: mixHex(base, 255, 0.52), to: mixHex(base, 255, 0.88), ink: mixHex(base, 0, 0.67) };
}

export const defaultCardMascots: CardMascot[] = [
  { id: "Tammy Cat", name: "แทมมี่", image: "/assets/member-mascot-cat.png" },
  { id: "Happy Dog", name: "น้องหมา", image: "/assets/member-mascot-dog.png" },
  { id: "Taco Cat", name: "ทาโก้", image: "/assets/member-mascot-taco.png" },
  { id: "Bunny", name: "กระต่าย", image: "/assets/member-mascot-bunny.png" },
  { id: "Poodle", name: "พุดเดิล", image: "/assets/member-mascot-poodle.png" },
];

export const defaultCardDesign: CardDesign = {
  themes: defaultCardThemes,
  mascots: defaultCardMascots,
  selectedTheme: "Coral Sunset",
  selectedMascot: "Tammy Cat",
  displayCustomization: false,
};

export function normalizeCardDesign(value: unknown): CardDesign {
  if (!value || typeof value !== "object") return defaultCardDesign;
  const source = value as Partial<CardDesign>;
  const themes = Array.isArray(source.themes) && source.themes.length ? source.themes.filter((item) => item && typeof item.id === "string" && typeof item.from === "string" && typeof item.to === "string") : defaultCardThemes;
  const mascots = Array.isArray(source.mascots) && source.mascots.length ? source.mascots.filter((item) => item && typeof item.id === "string" && typeof item.image === "string").map((item) => {
    if (item.id === "Tammy Cat" && item.image === "/assets/tammy-sidebar-cat.png") return { ...item, name: "แทมมี่", image: "/assets/member-mascot-cat.png" };
    if (item.id === "Mochi Cat" && item.image === "/assets/member-mascot-cat.png") return { ...item, id: "Taco Cat", name: "ทาโก้", image: "/assets/member-mascot-taco.png" };
    return item;
  }) : defaultCardMascots;
  const selectedMascot = source.selectedMascot === "Mochi Cat"
    ? (mascots.some((item) => item.id === "Tammy Cat") ? "Tammy Cat" : "Taco Cat")
    : typeof source.selectedMascot === "string" ? source.selectedMascot : defaultCardDesign.selectedMascot;
  return {
    themes: themes.length ? themes : defaultCardThemes,
    mascots: mascots.length ? mascots : defaultCardMascots,
    selectedTheme: typeof source.selectedTheme === "string" ? source.selectedTheme : defaultCardDesign.selectedTheme,
    selectedMascot,
    displayCustomization: source.displayCustomization === true,
  };
}
