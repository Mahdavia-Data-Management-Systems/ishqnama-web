import styles from "./sura-header.module.css";

interface JuzHeaderProps {
  juzNumber: number;
  arabicName: string;
  transliteratedName: string;
  range?: string;
}

export default function JuzHeader({
  juzNumber,
  arabicName,
  transliteratedName,
  range,
}: JuzHeaderProps) {
  return (
    <div className={`${styles.header} ornament-girih`}>
      <div className={styles.inner}>
        <span className={styles.number}>{juzNumber}</span>
        <div className={styles.content}>
          <h1 className={styles.arabicName} dir="rtl" lang="ar">
            {arabicName}
          </h1>
          <h2 className={styles.name}>{transliteratedName}</h2>
          {range && (
            <div className={styles.badges}>
              <span className={styles.meta}>{range}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
