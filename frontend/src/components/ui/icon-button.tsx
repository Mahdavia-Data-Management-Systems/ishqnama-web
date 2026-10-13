"use client";

import Icon from "./icon";
import styles from "./icon-button.module.css";

interface IconButtonProps {
  icon: string;
  label: string;
  size?: "sm" | "md";
  variant?: "default" | "ghost" | "on-dark";
  filled?: boolean;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export default function IconButton({
  icon,
  label,
  size = "md",
  variant = "default",
  filled = false,
  onClick,
  className = "",
  disabled = false,
}: IconButtonProps) {
  const iconSize = size === "sm" ? 18 : 20;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`${styles.iconButton} ${styles[size]} ${styles[variant]} ${className}`}
    >
      <Icon name={icon} size={iconSize} filled={filled} />
    </button>
  );
}
