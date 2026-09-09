import type { ReactNode } from "react";
import styles from "./ayah-marker-container.module.css";

interface AyahMarkerContainerProps {
  variant: "positioned" | "floated";
  children: ReactNode;
}

export default function AyahMarkerContainer({ variant, children }: AyahMarkerContainerProps) {
  if (!children) return null;

  return <span className={styles[variant]}>{children}</span>;
}
