import Link from "next/link";
import styles from "./saved-verse-card.module.css";

interface SavedVerseCardProps {
  suraNumber: number;
  suraName: string;
  verseNumber: number;
  arabicText: string;
  translationText: string;
}

export default function SavedVerseCard({
  suraNumber,
  suraName,
  verseNumber,
  arabicText,
  translationText,
}: SavedVerseCardProps) {
  return (
    <Link href={`/quran/${suraNumber}/`} className={styles.card}>
      <div className={styles.meta}>
        <span className={styles.ref}>
          {suraName} {suraNumber}:{verseNumber}
        </span>
      </div>
      <p className={styles.arabic} dir="rtl" lang="ar">
        {arabicText}
      </p>
      <hr className="hairline-gold" />
      <p className={styles.translation}>{translationText}</p>
    </Link>
  );
}
