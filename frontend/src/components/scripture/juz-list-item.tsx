import Link from "next/link";
import RukuRail from "@/components/scripture/ruku-rail";
import type { TranslationLang } from "@/components/scripture/ayah-block";
import { rukusInJuz } from "@/data/rukus";
import styles from "./sura-list-item.module.css";

interface JuzListItemProps {
  juzNumber: number;
  arabicName: string;
  transliteratedName: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
  lang: TranslationLang;
  /** Whether to show the ruku rail (the reader's "For juz" setting). */
  showRukuRail: boolean;
}

export default function JuzListItem({
  juzNumber,
  arabicName,
  transliteratedName,
  startChapter,
  startVerse,
  endChapter,
  endVerse,
  lang,
  showRukuRail,
}: JuzListItemProps) {
  return (
    <div className={styles.item}>
      <Link href={`/quran/juz/${juzNumber}/`} className={styles.header}>
        <span className={styles.number}>{juzNumber}</span>

        <div className={styles.info}>
          <div className={styles.primary}>
            <span className={styles.name}>{transliteratedName}</span>
          </div>
          <span className={styles.meta}>
            {startChapter}:{startVerse} — {endChapter}:{endVerse}
          </span>
        </div>

        <div className={styles.arabicSide}>
          <span className={styles.arabicName} dir="rtl" lang="ar">
            {arabicName}
          </span>
        </div>
      </Link>

      {showRukuRail && (
        <RukuRail
          rukus={rukusInJuz(juzNumber)}
          hrefFor={(r) => `/quran/juz/${juzNumber}/ruku/${r.rankInJuz}/`}
          lang={lang}
          label={`Rukus of juz ${juzNumber}`}
          breakAt="chapter"
        />
      )}
    </div>
  );
}
