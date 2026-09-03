import styles from "./sura-header.module.css";

interface RukuHeaderProps {
  rank: number;
  totalRukus: number;
  parentLabel: string;
  verseCount?: number;
}

export default function RukuHeader({
  rank,
  totalRukus,
  parentLabel,
  verseCount,
}: RukuHeaderProps) {
  return (
    <div className={`${styles.header} ornament-girih`}>
      <div className={styles.inner}>
        <span className={styles.number}>{rank}</span>
        <div className={styles.content}>
          <h1 className={styles.name}>Ruku {rank} of {totalRukus}</h1>
          <h2 className={styles.arabicName} style={{ fontSize: "1.25rem" }}>
            {parentLabel}
          </h2>
          {verseCount !== undefined && (
            <div className={styles.badges}>
              <span className={styles.meta}>{verseCount} verses</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
