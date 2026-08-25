"use client";

import type { ReactNode } from "react";
import styles from "./segmented-control.module.css";

export interface SegmentedOption {
  label: string;
  value: string;
  shortLabel?: string;
  icon?: ReactNode;
  ariaLabel?: string;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
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
          aria-label={option.ariaLabel}
          onClick={() => onChange(option.value)}
          className={`${styles.segment} ${value === option.value ? styles.active : ""}`}
          {...(option.icon ? { "data-seg-has-icon": "" } : {})}
        >
          {option.icon && <span data-seg-content="icon">{option.icon}</span>}
          {option.shortLabel && <span data-seg-content="short">{option.shortLabel}</span>}
          <span data-seg-content="full">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
