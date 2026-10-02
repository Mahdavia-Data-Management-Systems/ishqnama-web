"use client";

import { useState } from "react";
import Link from "next/link";
import ArabicPassage from "@/components/lists/arabic-passage";
import Sheet from "@/components/lists/sheet";
import Icon from "@/components/ui/icon";
import { LISTS_COPY } from "@/config/lists-copy";
import { UNREACHABLE_MESSAGE, WARMING_MESSAGE } from "@/config/readiness-copy";
import { useArabicVerses } from "@/hooks/use-arabic-verses";
import { useApiReadiness } from "@/lib/api-readiness";
import { GROUP_PREVIEW_VERSES, groupReaderPath, groupReference } from "@/lib/verse-lists";
import type { VerseListGroupDto } from "@/types/lists";
import styles from "./list-group-card.module.css";

/** ﷽, "In the name of Allah, the Most Gracious, the Most Merciful", heading every group. */
const BISMILLAH = "﷽";

/**
 * One group on a list page: its caption and reference, then the Arabic in continuous mode. A
 * group longer than GROUP_PREVIEW_VERSES shows its first verses and "Read more", which opens the
 * whole group in a sheet; both come from the same request.
 */
export default function ListGroupCard({ group }: { group: VerseListGroupDto }) {
  const { verses, failed } = useArabicVerses(group.chapter, group.fromVerse, group.toVerse);
  const [expanded, setExpanded] = useState(false);
  const readiness = useApiReadiness();
  const reference = groupReference(group);
  const isLong = group.toVerse - group.fromVerse + 1 > GROUP_PREVIEW_VERSES;

  const waitingText =
    failed || readiness === "unreachable"
      ? UNREACHABLE_MESSAGE
      : readiness === "warming"
        ? WARMING_MESSAGE
        : null;

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        {/* U+FDFD, drawn by the Quran font itself (PDMS Saleem Quran carries the glyph) */}
        <p className={styles.bismillah} dir="rtl" lang="ar">
          {BISMILLAH}
        </p>
        <div className={styles.titles}>
          {group.caption && <h3 className={styles.caption}>{group.caption}</h3>}
          <p className={styles.reference}>{reference}</p>
        </div>
      </header>

      {verses ? (
        <ArabicPassage chapter={group.chapter} verses={isLong ? verses.slice(0, GROUP_PREVIEW_VERSES) : verses} />
      ) : (
        <div className={styles.placeholder} aria-busy="true">
          <span className={styles.shimmer} />
          <span className={styles.shimmer} />
          {waitingText && <p className={styles.waiting}>{waitingText}</p>}
        </div>
      )}

      <footer className={styles.footer}>
        {isLong && verses && (
          <button type="button" className={styles.readMore} onClick={() => setExpanded(true)}>
            {LISTS_COPY.readMore}
          </button>
        )}
        <Link href={groupReaderPath(group)} className={styles.openLink}>
          {LISTS_COPY.openInReader}
          <Icon name="chevronRight" size={16} />
        </Link>
      </footer>

      {expanded && verses && (
        <Sheet title={group.caption || reference} subtitle={group.caption ? reference : undefined} size="tall" onClose={() => setExpanded(false)}>
          <ArabicPassage chapter={group.chapter} verses={verses} />
        </Sheet>
      )}
    </article>
  );
}
