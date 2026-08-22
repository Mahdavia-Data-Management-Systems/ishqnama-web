"use client";

import styles from "./segmented-control.module.css";

interface SegmentedControlProps {
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
}

export default function SegmentedControl({
  options,
  value,
  onChange,
  size = "md",
  className = "",
}: SegmentedControlProps) {
  return (
    <div className={`${styles.wrapper} ${styles[size]} ${className}`} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`${styles.segment} ${value === option.value ? styles.active : ""}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
