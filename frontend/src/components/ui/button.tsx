"use client";

import Icon from "./icon";
import styles from "./button.module.css";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  icon?: string;
  iconAfter?: string;
  fullWidth?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconAfter,
  fullWidth = false,
  onClick,
  type = "button",
  disabled = false,
  className = "",
}: ButtonProps) {
  const iconSize = size === "sm" ? 16 : size === "lg" ? 20 : 18;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${fullWidth ? styles.fullWidth : ""} ${className}`}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      <span>{children}</span>
      {iconAfter && <Icon name={iconAfter} size={iconSize} />}
    </button>
  );
}
