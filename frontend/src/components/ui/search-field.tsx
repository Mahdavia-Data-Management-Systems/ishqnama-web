"use client";

import Icon from "./icon";
import styles from "./search-field.module.css";

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  inputStyle?: React.CSSProperties;
  dir?: "ltr" | "rtl";
}

export default function SearchField({
  value,
  onChange,
  placeholder = "Search",
  className = "",
  autoFocus = false,
  inputStyle,
  dir,
}: SearchFieldProps) {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      <Icon name="search" size={18} className={styles.icon} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={styles.input}
        autoFocus={autoFocus}
        style={inputStyle}
        dir={dir}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className={styles.clear}
          aria-label="Clear search"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
