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
  /**
   * Below the named breakpoint ("sm" is 640px) a button shows its icon and short label
   * instead of its full label, when it has one; the aria-label still names it in full.
   * Left out, the full label shows at every width.
   */
  collapseBelow?: "sm";
}

export default function SegmentedControl({
  options,
  value,
  onChange,
  size = "md",
  className = "",
  collapseBelow,
}: SegmentedControlProps) {
  return (
    <div
      className={`${styles.wrapper} ${styles[size]} ${className}`}
      role="tablist"
      {...(collapseBelow ? { "data-collapse": collapseBelow } : {})}
    >
      {options.map((option) => (
        <button
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          aria-label={option.ariaLabel}
          onClick={() => onChange(option.value)}
          className={`${styles.segment} ${value === option.value ? styles.active : ""}`}
          {...(option.icon ? { "data-seg-has-icon": "" } : {})}
          {...(option.icon || option.shortLabel ? { "data-seg-compact": "" } : {})}
        >
          {option.icon && <span data-seg-content="icon">{option.icon}</span>}
          {option.shortLabel && <span data-seg-content="short">{option.shortLabel}</span>}
          <span data-seg-content="full">{option.label}</span>
        </button>
      ))}
    </div>
  );
}
