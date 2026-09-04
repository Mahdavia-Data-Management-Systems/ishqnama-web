import type { TranslationLang } from "@/components/scripture/ayah-block";
import { localizeNumber } from "@/lib/translation-map";
import styles from "./ruku-mark.module.css";

interface RukuMarkProps {
  variant: "positioned" | "floated";
  rukuId: number;
  rankInChapter?: number;
  rankInJuz?: number;
  verseCount?: number;
  lang?: TranslationLang;
}

export default function RukuMark({ variant, rukuId, rankInChapter, rankInJuz, verseCount, lang = "english" }: RukuMarkProps) {
  return (
    <span className={styles[variant]}>
      <span className={styles.ain}>
        {rankInChapter != null && <span className={styles.above}>{localizeNumber(rankInChapter, lang)}</span>}
        ع
        {verseCount != null && <span className={styles.overlay}>{localizeNumber(verseCount, lang)}</span>}
        {rankInJuz != null && <span className={styles.below}>{localizeNumber(rankInJuz, lang)}</span>}
      </span>
    </span>
  );
}
