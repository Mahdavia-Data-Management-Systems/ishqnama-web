import Link from "next/link";
import Badge from "@/components/ui/badge";
import RukuRail from "@/components/scripture/ruku-rail";
import type { TranslationLang } from "@/components/scripture/ayah-block";
import { rukusInChapter } from "@/data/rukus";
import styles from "./sura-list-item.module.css";

interface SuraListItemProps {
  number: number;
  name: string;
  arabicName: string;
  urduName?: string;
  revelationType: "Makki" | "Madani";
  verseCount: number;
  lang: TranslationLang;
  /** Whether to show the ruku rail (the reader's "For sura" setting). */
  showRukuRail: boolean;
}

export default function SuraListItem({
  number,
  name,
  arabicName,
  urduName,
  revelationType,
  verseCount,
  lang,
  showRukuRail,
}: SuraListItemProps) {
  const rukus = rukusInChapter(number);

  return (
    <div className={`${styles.item} ${revelationType === "Makki" ? styles.makki : styles.madani}`}>
      <Link href={`/quran/${number}/`} className={styles.header}>
        <span className={styles.number}>{number}</span>

        <div className={styles.info}>
          <div className={styles.primary}>
            <span className={styles.name}>{name}</span>
            <Badge tone={revelationType === "Makki" ? "makki" : "madani"}>
              {revelationType}
            </Badge>
          </div>
          <span className={styles.meta}>{verseCount} verses</span>
        </div>

        <div className={styles.arabicSide}>
          {urduName && (
            <span className={styles.urduName} dir="rtl" lang="ur">
              {urduName}
            </span>
          )}
          <span className={styles.arabicName} dir="rtl" lang="ar">
            {arabicName}
          </span>
        </div>
      </Link>

      {showRukuRail && rukus.length > 1 && (
        <RukuRail
          rukus={rukus}
          hrefFor={(r) => `/quran/${number}/ruku/${r.rankInChapter}/`}
          lang={lang}
          label={`Rukus of ${name}`}
          breakAt="juz"
        />
      )}
    </div>
  );
}
