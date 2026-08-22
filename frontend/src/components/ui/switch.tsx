"use client";

import styles from "./switch.module.css";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export default function Switch({ checked, onChange, label, className = "" }: SwitchProps) {
  return (
    <label className={`${styles.wrapper} ${className}`}>
      {label && <span className={styles.label}>{label}</span>}
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`${styles.track} ${checked ? styles.on : ""}`}
      >
        <span className={styles.thumb} />
      </button>
    </label>
  );
}
