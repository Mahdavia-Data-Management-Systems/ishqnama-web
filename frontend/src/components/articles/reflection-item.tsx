import type { Reflection } from "@/types/articles";
import styles from "./reflection-item.module.css";

interface ReflectionItemProps {
  reflection: Reflection;
}

/**
 * One recording about an essay, as a row of the reflections list: named by its caption (its
 * title is only the essay's), with its description beneath. How it is heard is to be designed.
 */
export default function ReflectionItem({ reflection }: ReflectionItemProps) {
  return (
    <li className={styles.item}>
      <h2 className={styles.caption}>{reflection.caption ?? reflection.title}</h2>
      {reflection.description && <p className={styles.description}>{reflection.description}</p>}
    </li>
  );
}
