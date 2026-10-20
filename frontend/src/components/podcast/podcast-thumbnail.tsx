"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import ThemedLogo from "@/components/themed-logo";
import styles from "./podcast-thumbnail.module.css";

/** Which part of the picture the title takes: the half the artist left empty, or the gap between the hosts. */
export type ThumbnailTitleAlign = "left" | "right" | "center";

export interface ThumbnailTitleSegment {
  text: string;
  highlighted: boolean;
}

interface PodcastThumbnailProps {
  /** The title over the art, with the word or two to highlight between asterisks: "Kya Quran mein *Naskh* hai?" */
  title: string;
  imageUrl: string;
  align?: ThumbnailTitleAlign;
  /** The recording's length as a clock reads it ("19:48"), shown in the bottom right corner. */
  duration?: string;
  className?: string;
}

/** The title's size relative to its first try, stepped down until its longest word fits its space. */
const FIT_STEPS = [1, 0.9, 0.8, 0.7, 0.6];

/**
 * The title split at its asterisks into runs: the ones between a pair are highlighted. An unpaired
 * asterisk is ordinary text, so a title without any marks shows as written.
 */
export function parseThumbnailTitle(title: string): ThumbnailTitleSegment[] {
  const segments: ThumbnailTitleSegment[] = [];
  const pattern = /\*([^*]+)\*/g;
  let last = 0;
  for (const match of title.matchAll(pattern)) {
    if (match.index > last) segments.push({ text: title.slice(last, match.index), highlighted: false });
    segments.push({ text: match[1], highlighted: true });
    last = match.index + match[0].length;
  }
  if (last < title.length) segments.push({ text: title.slice(last), highlighted: false });
  return segments;
}

/** The title as plain words, for an accessible name. */
export function plainThumbnailTitle(title: string): string {
  return parseThumbnailTitle(title).map((s) => s.text).join("");
}

/**
 * A recording's picture card: the released art (the hosts drawn on a transparent ground, so the
 * card paints the gold wash they sit on in both themes) with the title set over the part of the
 * picture the artist left empty, its marked words on a bright gold block, and the recording's
 * length in the bottom right corner. The art's own ratio is kept, and the title scales with the
 * card's width, so one card reads the same as a list thumbnail and as a full-width poster on a
 * phone. A marked term never breaks at its hyphens ("Harf-e-zaid" stays one word); when such a
 * word is wider than the title's space, the title steps down in size until it fits.
 */
export default function PodcastThumbnail({ title, imageUrl, align = "right", duration, className }: PodcastThumbnailProps) {
  const titleRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const fit = () => {
      let step = 0;
      el.style.setProperty("--title-fit", String(FIT_STEPS[step]));
      while (step < FIT_STEPS.length - 1 && el.scrollWidth > el.clientWidth + 1) {
        step++;
        el.style.setProperty("--title-fit", String(FIT_STEPS[step]));
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [title, align]);

  const runs: ReactNode[] = parseThumbnailTitle(title).map((segment, i) =>
    segment.highlighted ? (
      <mark key={i} className={styles.highlight}>
        {segment.text.split(" ").map((word, j) => (
          <span key={j} className={styles.word}>
            {j > 0 && " "}
            {word}
          </span>
        ))}
      </mark>
    ) : (
      <span key={i}>{segment.text}</span>
    ),
  );

  // Spans throughout (blocks by stylesheet), so the card can sit inside a button or a link.
  return (
    <span className={[styles.card, className].filter(Boolean).join(" ")} data-align={align}>
      <img className={styles.art} src={imageUrl} alt="" width={1328} height={800} loading="lazy" decoding="async" draggable={false} />
      {/* The mark is decoration: the card's name comes from its title */}
      <span className={styles.brand}>
        <ThemedLogo alt="" width={38} height={32} className={styles.logo} />
      </span>
      {/* One inline run inside the centring column, so a mark sits in its sentence like any word */}
      <span ref={titleRef} className={styles.title}>
        <span className={styles.runs}>{runs}</span>
      </span>
      {duration && <span className={styles.duration}>{duration}</span>}
    </span>
  );
}
