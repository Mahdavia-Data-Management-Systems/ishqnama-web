"use client";

import { useState, useRef, useEffect } from "react";
import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "@/config/auth-config";
import { useReaderSettings } from "@/context/reader-settings-context";
import Icon from "@/components/ui/icon";
import styles from "./user-menu.module.css";

export default function UserMenu() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { openSettings } = useReaderSettings();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  if (!isAuthenticated) {
    return (
      <button
        onClick={() => instance.loginRedirect(loginRequest)}
        className={styles.signInButton}
      >
        <Icon name="logIn" size={18} />
        <span>Sign in</span>
      </button>
    );
  }

  const account = accounts[0];
  const name = account?.name ?? account?.username ?? "User";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={styles.wrapper} ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className={styles.avatarButton}
        aria-label="User menu"
      >
        <span className={styles.avatar}>{initials}</span>
        <Icon name="chevronDown" size={16} className={styles.chevron} />
      </button>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.userInfo}>
            <div className={styles.userName}>{name}</div>
            {account?.username && (
              <div className={styles.userEmail}>{account.username}</div>
            )}
          </div>
          <hr className={styles.divider} />
          <button onClick={() => setOpen(false)} className={styles.menuItem}>
            <Icon name="bookmark" size={18} />
            <span>Bookmarks</span>
          </button>
          <button onClick={() => setOpen(false)} className={styles.menuItem}>
            <Icon name="clock" size={18} />
            <span>Last read</span>
          </button>
          <button onClick={() => { setOpen(false); openSettings(); }} className={styles.menuItem}>
            <Icon name="settings" size={18} />
            <span>Reading settings</span>
          </button>
          <hr className={styles.divider} />
          <button
            onClick={() => {
              setOpen(false);
              instance.logoutRedirect();
            }}
            className={styles.menuItem}
          >
            <Icon name="logOut" size={18} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}
