import type { TranslationLang } from "@/components/scripture/ayah-block";

/** The CSS variable each translation's text is set in (see globals.css). */
const FONT_VARIABLE: Record<TranslationLang, string> = {
  urdu: "--font-urdu",
  hindi: "--font-hindi",
  english: "--font-display",
};

/** Used when the variable cannot be read; the names globals.css and next/font declare. */
const FALLBACK_FAMILY: Record<TranslationLang, string> = {
  urdu: "Jameel Noori Nastaleeq",
  hindi: "Noto Serif Devanagari",
  english: "EB Garamond",
};

/**
 * Text in the translation's script. The Google fonts are split by unicode-range, so the
 * browser only fetches the file covering the characters it is asked to load.
 */
const SAMPLE_TEXT: Record<TranslationLang, string> = {
  urdu: "اردو",
  hindi: "हिन्दी",
  english: "Aa",
};

/** How long a reader waits for the font before the text is shown in a fallback font. */
export const TRANSLATION_FONT_TIMEOUT_MS = 3000;

/** The first family in the translation's font stack, the one the text is meant to be set in. */
export function translationFontFamily(lang: TranslationLang, doc: Document = document): string {
  const stack = getComputedStyle(doc.documentElement).getPropertyValue(FONT_VARIABLE[lang]);
  const first = stack.split(",")[0]?.trim().replace(/^["']|["']$/g, "");
  return first || FALLBACK_FAMILY[lang];
}

/**
 * Resolves once the translation's font is ready to draw, or after `timeoutMs`, whichever comes
 * first. Browsers only fetch a web font once text on the page uses it, so without this the
 * verses would appear in a fallback font and shift when the real one arrives (the Urdu font
 * alone is 5.8 MB). The verse hooks start it alongside their fetch and show the verses when
 * both are done. Never rejects: a failed or slow font falls back to `font-display: swap`.
 */
export function ensureTranslationFont(
  lang: TranslationLang,
  timeoutMs: number = TRANSLATION_FONT_TIMEOUT_MS,
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return Promise.resolve();

  let load: Promise<unknown>;
  try {
    const family = translationFontFamily(lang);
    load = document.fonts.load(`1em "${family}"`, SAMPLE_TEXT[lang]);
  } catch {
    return Promise.resolve();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs);
  });
  return Promise.race([load.then(() => undefined, () => undefined), timeout]).finally(() =>
    clearTimeout(timer),
  );
}
