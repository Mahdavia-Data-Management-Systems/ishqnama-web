import Link from "next/link";
import Image from "next/image";
import styles from "./footer.module.css";

const footerLinks = [
  { href: "/about/", label: "About" },
  { href: "/contact/", label: "Contact" },
  { href: "/terms/", label: "Terms" },
  { href: "/privacy/", label: "Privacy" },
];

export default function Footer() {
  return (
    <footer className={styles.footer}>
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
        <p className={styles.tagline}>
          Noor e Imaan — <span lang="ur" dir="rtl">نورِ ایمان</span>
        </p>
      </div>
    </footer>
  );
}
