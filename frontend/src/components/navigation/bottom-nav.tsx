"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import Icon from "@/components/ui/icon";
import styles from "./bottom-nav.module.css";

const tabs = [
  { href: "/", icon: "home", label: "Home" },
  { href: "/quran/", icon: "book", label: "Quran" },
  { href: "/search/", icon: "search", label: "Search" },
  { href: "/saved/", icon: "bookmark", label: "Saved", authOnly: true },
];

export default function BottomNav() {
  const pathname = usePathname();
  const isAuthenticated = useIsAuthenticated();

  // Hide on reader pages — ReaderToolbar occupies the bottom there
  if (pathname.startsWith("/quran/") && pathname !== "/quran/") {
    return null;
  }

  return (
    <nav className={styles.nav} aria-label="Bottom navigation">
      {tabs.map((tab) => {
        if (tab.authOnly && !isAuthenticated) return null;
        const isActive =
          tab.href === "/"
            ? pathname === "/" || pathname === ""
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tab} ${isActive ? styles.active : ""}`}
          >
            <Icon name={tab.icon} size={20} />
            <span className={styles.label}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
