export type PosterFontKey = "ma-shan-zheng" | "zcool-kuaile" | "zhi-mang-xing";
const FONT_FAMILY_BY_KEY: Record<PosterFontKey, string> = {
  "ma-shan-zheng": "Ma Shan Zheng",
  "zcool-kuaile": "ZCOOL KuaiLe",
  "zhi-mang-xing": "Zhi Mang Xing"
};
const DEFAULT_FONT_KEY: PosterFontKey = "ma-shan-zheng";
export function normalizePosterFontKey(raw: unknown): PosterFontKey {
  if (typeof raw !== "string") return DEFAULT_FONT_KEY;
  const trimmed = raw.trim();
  if (!trimmed) return DEFAULT_FONT_KEY;
  const compact = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (compact === "roboto") return DEFAULT_FONT_KEY;
  if (compact === "mashanzheng") return "ma-shan-zheng";
  if (compact === "zcoolkuaile") return "zcool-kuaile";
  if (compact === "zhimangxing") return "zhi-mang-xing";
  return DEFAULT_FONT_KEY;
}
export type PosterFontResolveResult = {
  resolvedKey: PosterFontKey;
  fontFamily: string;
};
export function resolvePosterFontFamily(requestedFontFamily: unknown): PosterFontResolveResult {
  const resolvedKey = normalizePosterFontKey(requestedFontFamily);
  const defaultFamily = FONT_FAMILY_BY_KEY[DEFAULT_FONT_KEY];
  if (resolvedKey === DEFAULT_FONT_KEY) {
    return { resolvedKey, fontFamily: `${defaultFamily}, sans-serif` };
  }
  const requested = FONT_FAMILY_BY_KEY[resolvedKey];
  return {
    resolvedKey,
    fontFamily: `${requested}, ${defaultFamily}, sans-serif`
  };
}
