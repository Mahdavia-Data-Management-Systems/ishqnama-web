"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { THEME_MENU_LABEL, THEME_OPTIONS } from "@/config/theme-copy";
import { useTheme } from "@/lib/theme";
import styles from "./theme-menu.module.css";

/** App-bar button for Light / Dark / Match my device. Open to every reader; the choice is kept in this browser. */
export default function ThemeMenu() {
  const { preference, resolved, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  const icon = resolved === "dark" ? "moon" : "sun";

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={THEME_MENU_LABEL}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span data-icon={icon} className={styles.iconSlot}>
          <Icon name={icon} size={20} />
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label={THEME_MENU_LABEL}
          className={styles.dropdown}
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
          }}
        >
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={preference === option.value}
              className={styles.item}
              onClick={() => {
                setPreference(option.value);
                close();
              }}
            >
              <Icon name={option.icon} size={18} />
              <span className={styles.itemLabel}>{option.label}</span>
              {preference === option.value && <Icon name="check" size={16} className={styles.check} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
