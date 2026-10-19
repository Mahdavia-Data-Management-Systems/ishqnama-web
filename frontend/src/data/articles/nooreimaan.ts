import manifest from "./nooreimaan.json";
import reflectionsIndex from "./nooreimaan-reflections.json";
import type { EssayMeta, Reflection } from "@/types/articles";

/**
 * The essays of Noor e Imaan, in book order. The titles live in JSON so that
 * `scripts/build_nooreimaan_articles.py` reads the same list; the essays' text is served by the
 * API to signed-in readers and is never part of the static site.
 */
export const NOOR_E_IMAAN_ESSAYS: readonly EssayMeta[] = manifest;

export const NOOR_E_IMAAN_ESSAY_BY_SLUG = new Map(NOOR_E_IMAAN_ESSAYS.map((e) => [e.slug, e]));

export function essayPath(slug: string): string {
  return `/articles/nooreimaan/${slug}/`;
}

/** The reflections on an essay: the recorded discussions about it, beside the essay's text. */
export function reflectionsPath(slug: string): string {
  return `${essayPath(slug)}reflections/`;
}

/**
 * The static pages' copy of each essay's `reflections`, written from the essay files by
 * `scripts/build_nooreimaan_articles.py` and by `scripts/diarize_podcast.py` on every attach, so the
 * pages know which essays have recordings without the essay text. Essays without any are absent.
 */
// The JSON import widens the thumbnail's `align` to string; the API validates the file's values.
const REFLECTIONS_BY_SLUG = reflectionsIndex as Record<string, Reflection[]>;

/** An essay's recorded discussions in display order; `[]` for most essays. */
export function essayReflections(slug: string): Reflection[] {
  return REFLECTIONS_BY_SLUG[slug] ?? [];
}

/** The `generateStaticParams` of the essay page and its layout. */
export function essayStaticParams(): { slug: string }[] {
  return NOOR_E_IMAAN_ESSAYS.map(({ slug }) => ({ slug }));
}

/** The `generateStaticParams` of the reflections page: only the essays with recordings have one. */
export function reflectionsStaticParams(): { slug: string }[] {
  return NOOR_E_IMAAN_ESSAYS.filter(({ slug }) => essayReflections(slug).length > 0).map(({ slug }) => ({ slug }));
}

/** The essays either side in book order, or null past either end. */
export function essayNeighbours(slug: string): { previous: EssayMeta | null; next: EssayMeta | null } {
  const i = NOOR_E_IMAAN_ESSAYS.findIndex((e) => e.slug === slug);
  if (i < 0) return { previous: null, next: null };
  return {
    previous: i > 0 ? NOOR_E_IMAAN_ESSAYS[i - 1] : null,
    next: i < NOOR_E_IMAAN_ESSAYS.length - 1 ? NOOR_E_IMAAN_ESSAYS[i + 1] : null,
  };
}
