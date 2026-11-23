import Link from "next/link";
import styles from "../static-page.module.css";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Disclaimer",
  description:
    "What on Ishqnama comes from the Noor e Imaan book and what has been added by the Ishqnama team.",
  path: "/disclaimer/",
});

/* Every disclaimer the site makes lives on this page: add a new one as its own h2 section. */
export default function DisclaimerPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <span className={styles.eyebrow}>Legal</span>
        <h1 className={styles.title}>Disclaimer</h1>
        <div className={styles.body}>
          <p>
            Ishqnama presents the tarjuma and tafseer of the Noor e Imaan book.
            Where something on the site does not come from the book, this page
            says so.
          </p>
          <h2>Content</h2>
          <p>
            The Ishqnama team takes every care to preserve the integrity and
            accuracy of the text published here. Even so, in bringing a printed
            work to the screen, errors can occur. The Noor e Imaan book remains
            the authoritative source: where the tarjuma or tafseer on this
            website differs from the book, the book is correct.
          </p>
          <p>
            If you come across any such difference, or any other discrepancy on
            the website, we would be grateful if you would{" "}
            <Link href="/contact/">get in touch with us</Link>. Your report
            helps us correct the text and improve its accuracy for every
            reader.
          </p>
          <h2>Takhreej</h2>
          <p>
            Some tafseer passages carry takhreej: a list of the books that
            support the passage, opened from the small open-book button at its
            end. All takhreej content is provided by the Ishqnama R&amp;D team.
            It is not sourced from the mufassir or from the original Noor e
            Imaan book, and it should not be read as part of the tafseer.
          </p>
        </div>
      </div>
    </main>
  );
}
