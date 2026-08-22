import Link from "next/link";
import Icon from "@/components/ui/icon";
import styles from "./chapter-nav.module.css";

interface ChapterNavProps {
  prevSura?: { number: number; name: string } | null;
  nextSura?: { number: number; name: string } | null;
}

export default function ChapterNav({ prevSura, nextSura }: ChapterNavProps) {
  return (
    <nav className={styles.nav}>
      {prevSura ? (
        <Link href={`/quran/${prevSura.number}/`} className={styles.link}>
          <Icon name="chevronLeft" size={18} />
          <div>
            <span className={styles.label}>Previous</span>
            <span className={styles.name}>{prevSura.name}</span>
          </div>
        </Link>
      ) : (
        <span />
      )}

      {nextSura ? (
        <Link href={`/quran/${nextSura.number}/`} className={`${styles.link} ${styles.next}`}>
          <div>
            <span className={styles.label}>Next</span>
            <span className={styles.name}>{nextSura.name}</span>
          </div>
          <Icon name="chevronRight" size={18} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
