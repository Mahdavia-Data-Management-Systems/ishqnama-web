import { Children, type ReactNode } from "react";
import styles from "./ayah-marker-container.module.css";

interface AyahMarkerContainerProps {
  variant: "positioned" | "floated";
  children: ReactNode;
}

export default function AyahMarkerContainer({ variant, children }: AyahMarkerContainerProps) {
  // Skip the wrapper entirely when no marker applies, so the floated
  // variant never reserves gutter space on an unmarked verse
  const marks = Children.toArray(children);
  if (marks.length === 0) return null;

  return <span className={styles[variant]}>{marks}</span>;
}
