"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/icon";
import { THEME_MENU_LABEL, THEME_OPTIONS } from "@/config/theme-copy";
import { trackEvent } from "@/lib/telemetry";
import { useTheme } from "@/lib/theme";
import styles from "./theme-menu.module.css";

/** App-bar button for Light / Dark / Match my device. Open to every reader; the choice is kept in this browser. */
export default function ThemeMenu() {
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const checkedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    checkedRef.current?.focus();
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

  return (
    // Escape is handled on the wrapper so it closes the menu whether focus is on the
    // button or on an item.
    <div
      className={styles.wrapper}
      ref={wrapperRef}
      onKeyDown={(e) => {
        if (open && e.key === "Escape") close();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        aria-label={THEME_MENU_LABEL}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {/* Both icons are rendered and globals.css shows the one for data-theme: the server
            snapshot is always light, so choosing in React would show a dark reader the sun
            until hydration. */}
        <span data-icon="sun" className={`theme-icon-light ${styles.iconSlot}`}>
          <Icon name="sun" size={20} />
        </span>
        <span data-icon="moon" className={`theme-icon-dark ${styles.iconSlot}`}>
          <Icon name="moon" size={20} />
        </span>
      </button>

      {open && (
        <div role="menu" aria-label={THEME_MENU_LABEL} className={styles.dropdown}>
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              ref={preference === option.value ? checkedRef : undefined}
              type="button"
              role="menuitemradio"
              aria-checked={preference === option.value}
              className={styles.item}
              onClick={() => {
                if (option.value !== preference) trackEvent("theme-changed", { theme: option.value });
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
