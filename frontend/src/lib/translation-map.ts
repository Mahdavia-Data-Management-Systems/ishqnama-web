import type { TranslationLang } from "@/components/scripture/ayah-block";

const LANG_TO_ID: Record<TranslationLang, number> = {
  english: 1,
  urdu: 2,
  hindi: 3,
};

export function getTranslationId(lang: TranslationLang): number {
  return LANG_TO_ID[lang];
}
