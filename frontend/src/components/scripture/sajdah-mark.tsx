import styles from "./sajdah-mark.module.css";

export default function SajdahMark() {
  return (
    <span className={styles.wrapper} title="Place of prostration" aria-label="Place of prostration">
      <span className={styles.symbol}>۩</span>
    </span>
  );
}
