"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useIsAuthenticated } from "@azure/msal-react";
import BookModel from "@/components/book-model/book-model";
import ContinueReadingCard from "@/components/continue-reading-card";
import SectionHeading from "@/components/navigation/section-heading";
import QuranIndex from "@/components/scripture/quran-index";
import SuraCard from "@/components/scripture/sura-card";
import BookmarkTile from "@/components/bookmark-tile";
import AddBookmarkTile from "@/components/add-bookmark-tile";
import CreateBookmarkDialog from "@/components/create-bookmark-dialog";
import BookmarkTileSkeleton from "@/components/bookmark-tile-skeleton";
import { BOOKMARKS_UNREACHABLE_MESSAGE, BOOKMARKS_WARMING_MESSAGE } from "@/config/readiness-copy";
import { useBookmarks } from "@/context/bookmarks-context";
import { useApiReadiness } from "@/lib/api-readiness";
import { quranProgress } from "@/lib/quran-progress";
import { useDragToScroll } from "@/lib/use-drag-to-scroll";
import { useWheelToHorizontal } from "@/lib/use-wheel-to-horizontal";
import { suras } from "@/data/suras";
import styles from "./page.module.css";

// Commonly read chapters: Ya-Sin, Al-Kahf, Ar-Rahman, Al-Mulk, Al-Ikhlas,
// Al-Fath, Al-Waqi'ah, Al-Qadr.
const POPULAR_SURA_NUMBERS = [36, 18, 55, 67, 112, 48, 56, 97];
const popularSuras = POPULAR_SURA_NUMBERS.map((n) => suras[n - 1]);

export default function Home() {
  const isAuthenticated = useIsAuthenticated();
  const router = useRouter();
  const { bookmarks, status, addBookmark, removeBookmark } = useBookmarks();
  const readiness = useApiReadiness();
  const [dialogOpen, setDialogOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const suraRailRef = useRef<HTMLUListElement>(null);
  useWheelToHorizontal(suraRailRef);
  useDragToScroll(suraRailRef);

  const showSkeletons = bookmarks.length === 0 && (status === "loading" || status === "failed");
  const shelfCaption = !showSkeletons
    ? null
    : readiness === "warming"
      ? BOOKMARKS_WARMING_MESSAGE
      : readiness === "unreachable"
        ? BOOKMARKS_UNREACHABLE_MESSAGE
        : null;

  const nazra = bookmarks.find((b) => b.isDefault);
  const customBookmarks = bookmarks.filter((b) => !b.isDefault);

  const nazraSura = nazra ? suras.find((s) => s.number === nazra.chapterNumber) : null;
  const showContinue = nazra && nazra.verseNumber > 0 && nazraSura;

  return (
    <main className={styles.main}>
      <div className="page-container">
        {/* Hero / Continue reading */}
        <section className={styles.hero}>
          {isAuthenticated && showContinue ? (
            <ContinueReadingCard
              suraNumber={nazra.chapterNumber}
              suraName={nazraSura.name}
              arabicName={nazraSura.arabicName}
              verseNumber={nazra.verseNumber}
              totalVerses={nazraSura.verseCount}
              progress={quranProgress(nazra.chapterNumber, nazra.verseNumber)}
            />
          ) : (
            <div ref={heroRef} className={`${styles.heroCard} ornament-diagonal`}>
              <div className={styles.heroText}>
                <p className={styles.bismillah} dir="rtl" lang="ar">
                  بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ
                </p>
                <h1 className={styles.heroTitle}>
                  Noor e Imaan, The Holy Quran
                </h1>
                <p className={styles.heroBody}>
                  Read the Holy Quran with translations & explanation in Urdu, Hindi, and English, from authentic exegesis of Mahdavia Community.
                </p>
                <Link href="/quran/" className={styles.heroCta}>
                  Start reading
                </Link>
              </div>
              <BookModel variant="hero" className={styles.heroBook} tiltTargetRef={heroRef} priority />
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
            <div className={styles.bookmarkGrid}>
              {showSkeletons && (
                <>
                  <BookmarkTileSkeleton />
                  <BookmarkTileSkeleton />
                </>
              )}
              {customBookmarks.map((b) => (
                <BookmarkTile key={b.slug} bookmark={b} onDelete={removeBookmark} />
              ))}
              <AddBookmarkTile onClick={() => setDialogOpen(true)} />
            </div>
            {shelfCaption && <p className={styles.shelfCaption}>{shelfCaption}</p>}
            <CreateBookmarkDialog
              isOpen={dialogOpen}
              onClose={() => setDialogOpen(false)}
              onCreate={(title, icon) => addBookmark(title, icon)}
            />
          </section>
        )}

        {/* Chapter preview */}
        <section className={styles.section}>
          <SectionHeading
            eyebrow="Chapters"
            title="Begin reading"
          />
          <ul ref={suraRailRef} className={styles.suraRail}>
            {popularSuras.map((sura) => (
              <li key={sura.number} className={styles.suraRailItem}>
                <SuraCard
                  number={sura.number}
                  name={sura.name}
                  arabicName={sura.arabicName}
                  revelationType={sura.revelationType}
                  verseCount={sura.verseCount}
                />
              </li>
            ))}
          </ul>
        </section>

        {/* Complete index */}
        <section className={styles.section}>
          <QuranIndex />
        </section>
      </div>
    </main>
  );
}
