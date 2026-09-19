"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { isReaderRoute } from "@/lib/reader-route";
import styles from "./footer.module.css";

const footerLinks = [
  { href: "/about/", label: "About" },
  { href: "/contact/", label: "Contact" },
  { href: "/terms/", label: "Terms" },
  { href: "/privacy/", label: "Privacy" },
];

export default function Footer() {
  const pathname = usePathname();
  // Reader pages keep the fixed ReaderToolbar along the bottom at every width;
  // elsewhere only the phone bottom nav needs clearing (see the stylesheet).
  const clears = isReaderRoute(pathname) ? "toolbar" : "bottom-nav";

  return (
    <footer className={styles.footer} data-clears={clears}>
      <div className={styles.inner}>
        <Image
          src="/logo-ishqnama.svg"
          alt=""
          width={28}
          height={28}
          className={styles.logo}
          aria-hidden="true"
        />
        <nav className={styles.links}>
          {footerLinks.map((link) => (
            <Link key={link.href} href={link.href} className={styles.link}>
              {link.label}
            </Link>
          ))}
        </nav>
        <a
          href="https://mahdavisonline.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.credit}
        >
          <Image
            src="/images/mdms-mark.webp"
            alt=""
            width={22}
            height={22}
            unoptimized
            className={styles.creditMark}
            aria-hidden="true"
          />
          <span>
            Sign in provided by Mahdavia Data Management System
          </span>
        </a>
      </div>
    </footer>
  );
}
