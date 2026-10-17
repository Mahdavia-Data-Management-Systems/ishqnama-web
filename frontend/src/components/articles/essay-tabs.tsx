"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { essayPath, reflectionsPath } from "@/data/articles/nooreimaan";
import styles from "./essay-tabs.module.css";

export const ESSAY_TABS_LABEL = "Essay pages";
export const ARTICLE_TAB_LABEL = "Article";
export const REFLECTIONS_TAB_LABEL = "Reflections";

interface EssayTabsProps {
  slug: string;
}

/**
 * The two pages of an essay, Article and Reflections, as a row of links under its title: the
 * essay's text on one, the recorded discussions about it on the other. The current page is
 * marked for assistive technology and carries the gold rule. They are links, not ARIA tabs,
 * because each one is its own page with its own address.
 */
export default function EssayTabs({ slug }: EssayTabsProps) {
  // The segment under `[slug]`: "reflections" on that page, null on the essay itself.
  const current = useSelectedLayoutSegment() === "reflections" ? "reflections" : "article";

  return (
    <nav aria-label={ESSAY_TABS_LABEL} className={styles.tabs}>
      <Link
        href={essayPath(slug)}
        className={styles.tab}
        aria-current={current === "article" ? "page" : undefined}
      >
        {ARTICLE_TAB_LABEL}
      </Link>
      <Link
        href={reflectionsPath(slug)}
        className={styles.tab}
        aria-current={current === "reflections" ? "page" : undefined}
      >
        {REFLECTIONS_TAB_LABEL}
      </Link>
    </nav>
  );
}
