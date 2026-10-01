import type { MetadataRoute } from "next";
import { RUKUS } from "@/data/rukus";
import { siteUrl } from "@/lib/page-metadata";

/** Public pages outside the reader. Account-only routes and the MSAL bridge are left out, as in robots.txt. */
const STATIC_PATHS = ["/", "/quran/", "/about/", "/contact/", "/terms/", "/privacy/"];

/**
 * Every route path worth indexing, with trailing slashes to match the static export.
 *
 * Ruku pages are listed by chapter only: `/quran/juz/<j>/ruku/<r>/` shows the same passage as a
 * chapter ruku, and a chapter with a single ruku is left at `/quran/<c>/`, which shows the same
 * verses, so search engines are not offered the same text under two URLs.
 */
export function sitemapPaths(): string[] {
  const rukuCounts = new Map<number, number>();
  for (const r of RUKUS) rukuCounts.set(r.chapterNumber, (rukuCounts.get(r.chapterNumber) ?? 0) + 1);

  const chapters = Array.from({ length: 114 }, (_, i) => `/quran/${i + 1}/`);
  const juz = Array.from({ length: 30 }, (_, i) => `/quran/juz/${i + 1}/`);
  const rukus = RUKUS.filter((r) => (rukuCounts.get(r.chapterNumber) ?? 0) > 1).map(
    (r) => `/quran/${r.chapterNumber}/ruku/${r.rankInChapter}/`,
  );
  return [...STATIC_PATHS, ...chapters, ...juz, ...rukus];
}

/**
 * Entries for `sitemap.xml`, with absolute URLs on the build's `NEXT_PUBLIC_SITE_URL` origin.
 * No `lastModified`, `changeFrequency` or `priority`: the text never changes and Google ignores
 * the other two.
 */
export function sitemapFor(origin: URL = siteUrl()): MetadataRoute.Sitemap {
  return sitemapPaths().map((path) => ({ url: new URL(path, origin).href }));
}
