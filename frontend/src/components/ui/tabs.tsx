"use client";

import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./tabs.module.css";

export interface TabOption {
  label: string;
  value: string;
}

interface TabsProps {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  /** Accessible name for the tab list, e.g. "Saved". */
  label: string;
  /** Content of the selected tab, rendered inside its tab panel. */
  children: ReactNode;
  className?: string;
  panelClassName?: string;
}

/**
 * Text tabs on a hairline rule, with a gold rule that slides under the selected tab.
 * Renders the tab list and the selected tab's panel, wired up as an ARIA tabs pattern
 * (roving tabindex, arrow keys, Home and End; selection follows focus).
 */
export default function Tabs({
  options,
  value,
  onChange,
  label,
  children,
  className = "",
  panelClassName = "",
}: TabsProps) {
  const id = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const tabId = (v: string) => `${id}-tab-${v}`;
  const panelId = (v: string) => `${id}-panel-${v}`;

  useLayoutEffect(() => {
    const list = listRef.current;
    const measure = () => {
      const tab = tabRefs.current.get(value);
      if (tab) setIndicator({ left: tab.offsetLeft, width: tab.offsetWidth });
    };
    measure();
    if (!list || typeof ResizeObserver === "undefined") return;
    // Web fonts arriving or the viewport changing move the tabs; keep the rule under the label.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [value, options]);

  const select = (index: number) => {
    const next = options[(index + options.length) % options.length];
    onChange(next.value);
    tabRefs.current.get(next.value)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case "ArrowRight":
        select(index + 1);
        break;
      case "ArrowLeft":
        select(index - 1);
        break;
      case "Home":
        select(0);
        break;
      case "End":
        select(options.length - 1);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <>
      <div ref={listRef} role="tablist" aria-label={label} className={`${styles.list} ${className}`}>
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              ref={(el) => {
                if (el) tabRefs.current.set(option.value, el);
                else tabRefs.current.delete(option.value);
              }}
              type="button"
              role="tab"
              id={tabId(option.value)}
              aria-selected={selected}
              aria-controls={panelId(option.value)}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={styles.tab}
            >
              {option.label}
            </button>
          );
        })}
        {indicator && (
          <span
            aria-hidden="true"
            className={styles.indicator}
            style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }}
          />
        )}
      </div>
      <div
        role="tabpanel"
        id={panelId(value)}
        aria-labelledby={tabId(value)}
        tabIndex={0}
        className={`${styles.panel} ${panelClassName}`}
      >
        {children}
      </div>
    </>
  );
}
