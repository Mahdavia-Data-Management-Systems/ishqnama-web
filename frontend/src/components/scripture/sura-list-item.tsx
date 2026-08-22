import Link from "next/link";
import Badge from "@/components/ui/badge";
import styles from "./sura-list-item.module.css";

interface SuraListItemProps {
  number: number;
  name: string;
  arabicName: string;
  urduName?: string;
  revelationType: "Makki" | "Madani";
  verseCount: number;
}

export default function SuraListItem({
  number,
  name,
  arabicName,
  urduName,
  revelationType,
  verseCount,
}: SuraListItemProps) {
  return (
    <Link href={`/quran/${number}/`} className={`${styles.item} ${revelationType === "Makki" ? styles.makki : styles.madani}`}>
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
  );
}
