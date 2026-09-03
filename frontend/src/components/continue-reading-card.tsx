import Link from "next/link";
import Icon from "@/components/ui/icon";
import styles from "./continue-reading-card.module.css";

interface ContinueReadingCardProps {
  suraNumber: number;
  suraName: string;
  arabicName: string;
  verseNumber: number;
  totalVerses: number;
}

export default function ContinueReadingCard({
  suraNumber,
  suraName,
  arabicName,
  verseNumber,
  totalVerses,
}: ContinueReadingCardProps) {
  const progress = Math.round((verseNumber / totalVerses) * 100);

  return (
    <Link href={`/quran/${suraNumber}/?verse=${verseNumber}`} className={styles.card}>
      <div className={styles.header}>
        <span className={styles.eyebrow}>
          <Icon name="book" size={14} className={styles.nazraIcon} />
          Nazra — Continue reading
        </span>
        <Icon name="chevronRight" size={18} className={styles.arrow} />
      </div>

      <div className={styles.body}>
        <div>
          <span className={styles.suraName}>{suraName}</span>
          <span className={styles.verseInfo}>
            Verse {verseNumber} of {totalVerses}
          </span>
        </div>
        <span className={styles.arabic} dir="rtl" lang="ar">
          {arabicName}
        </span>
      </div>

      <div className={styles.progressTrack}>
        <div className={styles.progressFill} style={{ width: `${progress}%` }} />
      </div>
    </Link>
  );
}
