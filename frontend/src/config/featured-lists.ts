import { isProductionSite, siteUrl } from "@/lib/page-metadata";

/**
 * Published lists chosen by the site's editors. They appear under "Featured" on every signed-in
 * reader's Library page without anyone favouriting them, in this order. Add a list's id (the
 * `?id=` of its link, 12 letters and digits) to feature it; the change goes live with the next
 * deploy. A featured list that is later unpublished or deleted is simply left out.
 *
 * Each environment keeps its lists in its own Cosmos DB, so a list published on one does not
 * exist on another, and each has its own array: production ids are those of lists published on
 * ishqnama.com, dev ids those published on dev.ishqnama.com, and local ids those published on
 * localhost:3000, which the local API stores in the Cosmos DB emulator from docker-compose.
 */
export const PRODUCTION_FEATURED_LIST_IDS: readonly string[] = [];

export const DEV_FEATURED_LIST_IDS: readonly string[] = [];

export const LOCAL_FEATURED_LIST_IDS: readonly string[] = [];

/** Hosts of a build run on the developer's own machine (`npm run dev`, or a local static build). */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/** The featured ids for the site a build is served from, fixed at build time from `NEXT_PUBLIC_SITE_URL`. */
export function featuredListIdsFor(origin: URL = siteUrl()): readonly string[] {
  if (isProductionSite(origin)) return PRODUCTION_FEATURED_LIST_IDS;
  return LOCAL_HOSTS.has(origin.hostname) ? LOCAL_FEATURED_LIST_IDS : DEV_FEATURED_LIST_IDS;
}

export const FEATURED_LIST_IDS = featuredListIdsFor();
