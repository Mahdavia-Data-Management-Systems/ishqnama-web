import styles from "./section-heading.module.css";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function SectionHeading({
  eyebrow,
  title,
  action,
  className = "",
}: SectionHeadingProps) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      <div>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h2 className={styles.title}>{title}</h2>
      </div>
      {action && (
        <button onClick={action.onClick} className={styles.action}>
          {action.label}
        </button>
      )}
    </div>
  );
}
