import Link from "next/link";
import styles from "./sura-list-item.module.css";

interface JuzListItemProps {
  juzNumber: number;
  arabicName: string;
  transliteratedName: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

export default function JuzListItem({
  juzNumber,
  arabicName,
  transliteratedName,
  startChapter,
  startVerse,
  endChapter,
  endVerse,
}: JuzListItemProps) {
  return (
    <Link href={`/quran/juz/${juzNumber}/`} className={styles.item}>
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
  );
}
