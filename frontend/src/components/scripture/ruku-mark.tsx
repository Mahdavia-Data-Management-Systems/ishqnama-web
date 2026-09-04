import type { TranslationLang } from "@/components/scripture/ayah-block";
import { FONT_SIZE_STEPS } from "@/config/reader-config";
import { localizeNumber } from "@/lib/translation-map";
import styles from "./ruku-mark.module.css";

interface RukuMarkProps {
  variant: "positioned" | "floated";
  rukuId: number;
  rankInChapter?: number;
  rankInJuz?: number;
  verseCount?: number;
  lang?: TranslationLang;
  fontScale?: number;
}

export default function RukuMark({ variant, rukuId, rankInChapter, rankInJuz, verseCount, lang = "english", fontScale = 1 }: RukuMarkProps) {
  const numSize = `${Math.max(0.55, 0.55 * ((FONT_SIZE_STEPS[fontScale] ?? 100) / 100))}rem`;

  return (
    <span className={styles[variant]}>
      <span className={styles.ain}>
        {rankInChapter != null && <span className={`${styles.num} ${styles.above}`} style={{ fontSize: numSize }}>{localizeNumber(rankInChapter, lang)}</span>}
        ع
        {verseCount != null && <span className={`${styles.num} ${styles.overlay}`} style={{ fontSize: numSize }}>{localizeNumber(verseCount, lang)}</span>}
        {rankInJuz != null && <span className={`${styles.num} ${styles.below}`} style={{ fontSize: numSize }}>{localizeNumber(rankInJuz, lang)}</span>}
      </span>
    </span>
  );
}
