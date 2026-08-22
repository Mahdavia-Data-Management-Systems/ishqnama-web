import Icon from "@/components/ui/icon";
import Button from "@/components/ui/button";
import styles from "./empty-state.module.css";

interface EmptyStateProps {
  icon: string;
  title: string;
  body: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon, title, body, action }: EmptyStateProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.iconCircle}>
        <Icon name={icon} size={28} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.body}>{body}</p>
      {action && (
        <Button variant="secondary" size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
