"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import ContinueReadingCard from "@/components/continue-reading-card";
import SectionHeading from "@/components/navigation/section-heading";
import SuraListItem from "@/components/scripture/sura-list-item";
import EmptyState from "@/components/empty-state";
import { suras } from "@/data/suras";
import styles from "./page.module.css";

export default function Home() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const previewSuras = suras.slice(0, 6);

  return (
    <main className={styles.main}>
      <div className="page-container">
        {/* Hero / Continue reading */}
        <section className={styles.hero}>
          {isAuthenticated ? (
            <ContinueReadingCard
              suraNumber={1}
              suraName="al-Fātiḥah"
              arabicName="الفاتحة"
              verseNumber={3}
              totalVerses={7}
            />
          ) : (
            <div className={styles.heroCard}>
              <p className={styles.bismillah} dir="rtl" lang="ar">
                بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ
              </p>
              <h1 className={styles.heroTitle}>
                The Quran, with meaning
              </h1>
              <p className={styles.heroBody}>
                Read the Quran with Urdu, Hindi, and English translations, verse by verse or continuously.
              </p>
              <Link href="/quran/" className={styles.heroCta}>
                Start reading
              </Link>
            </div>
          )}
        </section>

        {/* Bookmarks */}
        {isAuthenticated && (
          <section className={styles.section}>
            <SectionHeading
              eyebrow="Your library"
              title="Bookmarks"
              action={{ label: "View all", onClick: () => router.push("/saved/") }}
            />
            <EmptyState
              icon="bookmark"
              title="No bookmarks yet"
              body="Bookmark verses while reading to find them here later."
              action={{ label: "Start reading", onClick: () => router.push("/quran/") }}
            />
          </section>
        )}

        {/* Chapter preview */}
        <section className={styles.section}>
          <SectionHeading
            eyebrow="Chapters"
            title="Begin reading"
            action={{ label: "View all 114", onClick: () => router.push("/quran/") }}
          />
          <div className={styles.suraList}>
            {previewSuras.map((sura) => (
              <SuraListItem
                key={sura.number}
                number={sura.number}
                name={sura.name}
                arabicName={sura.arabicName}
                urduName={sura.urduName}
                revelationType={sura.revelationType}
                verseCount={sura.verseCount}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
