"use client";

import styles from "./switch.module.css";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  /** Greyed out and not toggleable; it still shows its value. */
  disabled?: boolean;
  className?: string;
}

export default function Switch({ checked, onChange, label, disabled = false, className = "" }: SwitchProps) {
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ""} ${className}`}>
      {label && <span className={styles.label}>{label}</span>}
      <button
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`${styles.track} ${checked ? styles.on : ""}`}
      >
        <span className={styles.thumb} />
      </button>
    </label>
  );
}
