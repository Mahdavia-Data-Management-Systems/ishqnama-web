import styles from "./badge.module.css";

interface BadgeProps {
  children: React.ReactNode;
  tone?: "makki" | "madani" | "neutral";
  className?: string;
}

export default function Badge({ children, tone = "neutral", className = "" }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]} ${className}`}>
      {children}
    </span>
  );
}
