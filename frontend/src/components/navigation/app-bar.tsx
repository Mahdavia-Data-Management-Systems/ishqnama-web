"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import UserMenu from "./user-menu";
import styles from "./app-bar.module.css";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/quran/", label: "Chapters" },
  { href: "/search/", label: "Search" },
  { href: "/saved/", label: "Saved" },
];

export default function AppBar() {
  const pathname = usePathname();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-ishqnama-gold.svg"
            alt=""
            className={styles.logo}
            width={32}
            height={27}
          />
          <span className={styles.wordmark}>ISHQ NAMA</span>
        </Link>

        <nav className={styles.nav}>
          {navLinks.map((link) => {
            const isActive =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.navLink} ${isActive ? styles.active : ""}`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <UserMenu />
      </div>
    </header>
  );
}
