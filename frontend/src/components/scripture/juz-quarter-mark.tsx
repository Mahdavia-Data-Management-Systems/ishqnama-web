import type { JuzQuarter } from "@/data/juz-quarters";
import styles from "./juz-quarter-mark.module.css";

const LABELS: Record<JuzQuarter, { arabic: string; name: string }> = {
  1: { arabic: "الربع", name: "A quarter of the juz" },
  2: { arabic: "النصف", name: "Half of the juz" },
  3: { arabic: "الثلاثة", name: "Three quarters of the juz" },
};

export default function JuzQuarterMark({ quarter }: { quarter: JuzQuarter }) {
  const { arabic, name } = LABELS[quarter];
  return (
    <span className={styles.wrapper} title={name} aria-label={name} lang="ar">
      {arabic}
    </span>
  );
}
