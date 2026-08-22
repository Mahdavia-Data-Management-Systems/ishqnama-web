"use client";

import Icon from "./icon";
import styles from "./font-size-stepper.module.css";

interface FontSizeStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export default function FontSizeStepper({
  value,
  onChange,
  min = 0,
  max = 5,
  className = "",
}: FontSizeStepperProps) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={styles.step}
        aria-label="Decrease font size"
      >
        <span className={styles.label}>A</span>
        <Icon name="minus" size={12} />
      </button>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={styles.step}
        aria-label="Increase font size"
      >
        <span className={styles.labelLg}>A</span>
        <Icon name="plus" size={12} />
      </button>
    </div>
  );
}
