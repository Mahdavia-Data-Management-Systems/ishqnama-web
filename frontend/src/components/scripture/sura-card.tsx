import Link from "next/link";
import Badge from "@/components/ui/badge";
import styles from "./sura-card.module.css";

interface SuraCardProps {
  number: number;
  name: string;
  arabicName: string;
  revelationType: "Makki" | "Madani";
  verseCount: number;
}

export default function SuraCard({
  number,
  name,
  arabicName,
  revelationType,
  verseCount,
}: SuraCardProps) {
  return (
    <Link href={`/quran/${number}/`} className={`${styles.card} ${revelationType === "Makki" ? styles.makki : styles.madani}`}>
      <div className={styles.top}>
        <span className={styles.number}>{number}</span>
        <Badge tone={revelationType === "Makki" ? "makki" : "madani"}>
          {revelationType}
        </Badge>
      </div>

      <span className={styles.arabicName} dir="rtl" lang="ar">
        {arabicName}
      </span>

      <div>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{verseCount} verses</span>
      </div>
    </Link>
  );
}
