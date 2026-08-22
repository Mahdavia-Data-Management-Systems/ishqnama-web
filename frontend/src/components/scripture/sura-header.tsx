import Badge from "@/components/ui/badge";
import styles from "./sura-header.module.css";

interface SuraHeaderProps {
  number: number;
  name: string;
  arabicName: string;
  urduName?: string;
  revelationType: "Makki" | "Madani";
  verseCount: number;
}

export default function SuraHeader({
  number,
  name,
  arabicName,
  urduName,
  revelationType,
  verseCount,
}: SuraHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.inner}>
        <span className={styles.number}>{number}</span>
        <div className={styles.content}>
          <h1 className={styles.arabicName} dir="rtl" lang="ar">
            {arabicName}
          </h1>
          <h2 className={styles.name}>{name}</h2>
          {urduName && (
            <p className={styles.urduName} dir="rtl" lang="ur">
              {urduName}
            </p>
          )}
          <div className={styles.badges}>
            <Badge tone={revelationType === "Makki" ? "makki" : "madani"}>
              {revelationType}
            </Badge>
            <span className={styles.meta}>{verseCount} verses</span>
          </div>
        </div>
      </div>
    </div>
  );
}
