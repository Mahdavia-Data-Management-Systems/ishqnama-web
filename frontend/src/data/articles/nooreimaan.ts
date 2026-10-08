import manifest from "./nooreimaan.json";
import type { EssayMeta } from "@/types/articles";

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

/** The essays either side in book order, or null past either end. */
export function essayNeighbours(slug: string): { previous: EssayMeta | null; next: EssayMeta | null } {
  const i = NOOR_E_IMAAN_ESSAYS.findIndex((e) => e.slug === slug);
  if (i < 0) return { previous: null, next: null };
  return {
    previous: i > 0 ? NOOR_E_IMAAN_ESSAYS[i - 1] : null,
    next: i < NOOR_E_IMAAN_ESSAYS.length - 1 ? NOOR_E_IMAAN_ESSAYS[i + 1] : null,
  };
}
