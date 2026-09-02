import type { TranslationLang } from "@/components/scripture/ayah-block";

const LANG_TO_ID: Record<TranslationLang, number> = {
  english: 1,
  urdu: 2,
  hindi: 3,
};

export function getTranslationId(lang: TranslationLang): number {
  return LANG_TO_ID[lang];
}

const EASTERN_ARABIC = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
const DEVANAGARI = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

export function localizeNumber(n: number, lang: TranslationLang): string {
  const s = String(n);
  if (lang === "urdu") return s.replace(/\d/g, (d) => EASTERN_ARABIC[+d]);
  if (lang === "hindi") return s.replace(/\d/g, (d) => DEVANAGARI[+d]);
  return s;
}
