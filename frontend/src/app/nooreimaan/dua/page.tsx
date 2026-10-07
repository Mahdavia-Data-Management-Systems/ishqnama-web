import { Fragment } from "react";
import Link from "next/link";
import { KHATM_DUA, KHATM_DUA_TITLE, type DuaPhrase } from "@/data/khatm-dua";
import { pageMetadata } from "@/lib/page-metadata";
import styles from "./dua.module.css";

export const metadata = pageMetadata({
  title: "Dua for completing the Quran",
  description:
    "Dua khatm al-Quran, the supplication recited on completing the Holy Quran, as printed at the end of Noor e Imaan.",
  path: "/nooreimaan/dua/",
});

function Phrase({ phrase }: { phrase: DuaPhrase }) {
  if (typeof phrase === "string") return <>{phrase}</>;
  return (
    <>
      {phrase.map((run, i) =>
        typeof run === "string" ? (
          <Fragment key={i}>{run}</Fragment>
        ) : (
          <span key={i} className={styles.small}>
            {run.small}
          </span>
        ),
      )}
    </>
  );
}

export default function KhatmDuaPage() {
  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <h1 className={styles.title} lang="ar" dir="rtl">
          <span className={styles.bracket} aria-hidden="true">﴿</span>
          {KHATM_DUA_TITLE}
          <span className={styles.bracket} aria-hidden="true">﴾</span>
        </h1>
        <p className={styles.subtitle}>
          The dua for completing the Quran, as printed at the end of Noor e Imaan
        </p>
      </header>

      <div className={styles.page}>
        <p className={styles.dua} lang="ar" dir="rtl">
          {KHATM_DUA.map((phrase, i) => (
            <Fragment key={i}>
              <Phrase phrase={phrase} />{" "}
              <span className={styles.mark} aria-hidden="true">؀</span>{" "}
            </Fragment>
          ))}
        </p>
      </div>

      <p className={styles.next}>
        <Link href="/quran/1/">Begin again from Al-Fatiha</Link>
      </p>
    </main>
  );
}
