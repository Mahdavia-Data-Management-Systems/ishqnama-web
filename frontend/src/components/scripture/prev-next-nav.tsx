import Link from "next/link";
import Icon from "@/components/ui/icon";
import styles from "./prev-next-nav.module.css";

interface NavItem {
  href: string;
  name: string;
}

interface PrevNextNavProps {
  prev?: NavItem | null;
  next?: NavItem | null;
  prevLabel?: string;
  nextLabel?: string;
}

export default function PrevNextNav({
  prev,
  next,
  prevLabel = "Previous",
  nextLabel = "Next",
}: PrevNextNavProps) {
  return (
    <nav className={styles.nav}>
      {prev ? (
        <Link href={prev.href} className={styles.link}>
          <Icon name="chevronLeft" size={18} />
          <div>
            <span className={styles.label}>{prevLabel}</span>
            <span className={styles.name}>{prev.name}</span>
          </div>
        </Link>
      ) : (
        <span />
      )}

      {next ? (
        <Link href={next.href} className={`${styles.link} ${styles.next}`}>
          <div>
            <span className={styles.label}>{nextLabel}</span>
            <span className={styles.name}>{next.name}</span>
          </div>
          <Icon name="chevronRight" size={18} />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
