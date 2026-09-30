"use client";

import { useState } from "react";
import Link from "next/link";
import RukuMark from "@/components/scripture/ruku-mark";
import { JUZ_QUARTER_NAMES } from "@/components/scripture/juz-quarter-mark";
import type { TranslationLang } from "@/components/scripture/ayah-block";
import { JUZ_QUARTER_BY_RUKU, type JuzQuarter } from "@/data/juz-quarters";
import { suras } from "@/data/suras";
import { useDragToScroll } from "@/lib/use-drag-to-scroll";
import type { RukuDto } from "@/types/api";
import styles from "./ruku-rail.module.css";

/** One step above the reader default (FONT_SIZE_STEPS), so the small numbers stay legible at index size. */
const RAIL_FONT_SCALE = 1;

const QUARTER_GLYPHS: Record<JuzQuarter, string> = { 1: "¼", 2: "½", 3: "¾" };

interface RukuRailProps {
  rukus: RukuDto[];
  hrefFor: (ruku: RukuDto) => string;
  lang: TranslationLang;
  /** Accessible name of the whole rail, e.g. "Rukus of al-Baqarah". */
  label: string;
  /**
   * What the rail spans besides its own chapter or juz: a hairline marks where
   * the next one begins. A chapter rail breaks at each new juz; a juz rail
   * breaks at each new chapter and names the chapter in each link.
   */
  breakAt: "juz" | "chapter";
}

/**
 * A horizontal rail of ruku marks inside an index card, one link per ruku.
 * Touch swipes it and a mouse drags it; the wheel is left to the page, since
 * the index stacks over a hundred of these rails.
 */
export default function RukuRail({ rukus, hrefFor, lang, label, breakAt }: RukuRailProps) {
  const [rail, setRail] = useState<HTMLUListElement | null>(null);
  useDragToScroll(rail);

  return (
    <ul ref={setRail} className={styles.rail} aria-label={label} dir="ltr">
      {rukus.map((ruku, i) => {
        const key = breakAt === "juz" ? "juzNumber" : "chapterNumber";
        const startsNew = i > 0 && rukus[i - 1][key] !== ruku[key];
        const chapterName = breakAt === "chapter" ? suras[ruku.chapterNumber - 1]?.name : undefined;
        const quarter = JUZ_QUARTER_BY_RUKU.get(ruku.rukuId);
        const quarterName = quarter
          ? `, ${JUZ_QUARTER_NAMES[quarter.quarter].toLowerCase()}${quarter.after ? " after it" : ""}`
          : "";
        const name = `${chapterName ? `${chapterName}, ruku` : "Ruku"} ${ruku.rankInChapter}, ${ruku.verseCount} verses${quarterName}`;
        return (
          <li key={ruku.rukuId} className={startsNew ? `${styles.item} ${styles.startsNew}` : styles.item}>
            <Link href={hrefFor(ruku)} className={styles.link} aria-label={name} title={name}>
              <span className={styles.mark} aria-hidden="true">
                <RukuMark
                  rukuId={ruku.rukuId}
                  rankInChapter={ruku.rankInChapter}
                  verseCount={ruku.verseCount}
                  rankInJuz={ruku.rankInJuz}
                  lang={lang}
                  fontScale={RAIL_FONT_SCALE}
                />
              </span>
            </Link>
            {quarter && (
              <span className={quarter.after ? styles.quarterAfter : styles.quarterBelow} aria-hidden="true">
                {QUARTER_GLYPHS[quarter.quarter]}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
