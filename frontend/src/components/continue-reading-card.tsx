"use client";

import { useRef } from "react";
import Link from "next/link";
import Icon from "@/components/ui/icon";
import BookModel from "@/components/book-model/book-model";
import { useMediaQuery } from "@/lib/use-media-query";
import styles from "./continue-reading-card.module.css";

interface ContinueReadingCardProps {
  suraNumber: number;
  suraName: string;
  arabicName: string;
  verseNumber: number;
  totalVerses: number;
  /** Fraction through the whole Quran; when given, the book shows a ribbon at this point. */
  progress?: number;
}

export default function ContinueReadingCard({
  suraNumber,
  suraName,
  arabicName,
  verseNumber,
  totalVerses,
  progress,
}: ContinueReadingCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const wide = useMediaQuery("(min-width: 640px)");
  const verseProgress = Math.round((verseNumber / totalVerses) * 100);

  return (
    <Link
      ref={cardRef}
      href={`/quran/${suraNumber}/?verse=${verseNumber}`}
      className={styles.card}
    >
      <div className={styles.layout}>
        <div className={styles.content}>
          <div className={styles.header}>
            <span className={styles.eyebrow}>
              <Icon name="book" size={14} className={styles.nazraIcon} />
              Nazra — Continue reading
            </span>
            <Icon name="chevronRight" size={18} className={styles.arrow} />
          </div>

          <div className={styles.body}>
            <div>
              <span className={styles.suraName}>{suraName}</span>
              <span className={styles.verseInfo}>
                Verse {verseNumber} of {totalVerses}
              </span>
            </div>
            <span className={styles.arabic} dir="rtl" lang="ar">
              {arabicName}
            </span>
          </div>

          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${verseProgress}%` }}
              data-progress-fill
            />
          </div>
        </div>

        {progress !== undefined && (
          <BookModel
            variant="card"
            progress={progress}
            live={wide}
            className={styles.book}
            tiltTargetRef={cardRef}
          />
        )}
      </div>
    </Link>
  );
}
