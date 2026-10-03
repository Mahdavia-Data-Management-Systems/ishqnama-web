import { isProductionSite, siteUrl } from "@/lib/page-metadata";

/**
 * A published list chosen by the site's editors. `id` is the `?id=` of its link (12 letters and
 * digits). `byAdmin` credits the list to the site rather than to the reader who compiled it: its
 * owner name is hidden and it reads "Compiled by Admin" wherever the owner would show. That only
 * changes what the site displays; the API still returns the owner's name with the list.
 */
export interface FeaturedList {
  id: string;
  byAdmin?: boolean;
}

/**
 * Featured lists appear under "Featured" on every signed-in reader's Library page without anyone
 * favouriting them, in this order. Add an entry to feature a list; the change goes live with the
 * next deploy. A featured list that is later unpublished or deleted is simply left out.
 *
 * Each environment keeps its lists in its own Cosmos DB, so a list published on one does not
 * exist on another, and each has its own array: production entries are lists published on
 * ishqnama.com, dev entries those published on dev.ishqnama.com, and local entries those published
 * on localhost:3000, which the local API stores in the Cosmos DB emulator from docker-compose.
 */
export const PRODUCTION_FEATURED_LISTS: readonly FeaturedList[] = [];

export const DEV_FEATURED_LISTS: readonly FeaturedList[] = [];

export const LOCAL_FEATURED_LISTS: readonly FeaturedList[] = [{ id: "UGPmNzg2tP3q" }, { id: "ZLlPfWHAOgcq", byAdmin: true }];

/** Hosts of a build run on the developer's own machine (`npm run dev`, or a local static build). */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** The featured lists for the site a build is served from, fixed at build time from `NEXT_PUBLIC_SITE_URL`. */
export function featuredListsFor(origin: URL = siteUrl()): readonly FeaturedList[] {
  if (isProductionSite(origin)) return PRODUCTION_FEATURED_LISTS;
  return LOCAL_HOSTS.has(origin.hostname) ? LOCAL_FEATURED_LISTS : DEV_FEATURED_LISTS;
}

const FEATURED_LISTS = featuredListsFor();

export const FEATURED_LIST_IDS: readonly string[] = FEATURED_LISTS.map((l) => l.id);

/** Ids of the featured lists credited to the site ("Compiled by Admin") instead of their owner. */
export const ADMIN_LIST_IDS: ReadonlySet<string> = new Set(
  FEATURED_LISTS.filter((l) => l.byAdmin).map((l) => l.id),
);
