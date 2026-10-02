import { initials } from "@/lib/verse-lists";
import styles from "./owner-avatar.module.css";

/** A round initials badge for whoever compiled a list; there are no profile pictures. */
export default function OwnerAvatar({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const letters = initials(name);
  return (
    <span className={`${styles.avatar} ${styles[size]}`} aria-hidden="true">
      {letters || "·"}
    </span>
  );
}
