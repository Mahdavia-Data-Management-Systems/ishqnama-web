import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/page-metadata";

/** Hosts search engines may crawl. Every other environment (dev.ishqnama.com) is kept out. */
const PRODUCTION_HOSTS = new Set(["ishqnama.com", "www.ishqnama.com"]);

/**
 * Routes with nothing worth indexing: the MSAL redirect bridge, the signed-in Saved page, and
 * search, whose results need an account and whose empty shell would only be a thin page.
 */
export const DISALLOWED_PATHS = ["/redirect/", "/saved/", "/search/"];

/**
 * Rules for `robots.txt`, fixed at build time from `NEXT_PUBLIC_SITE_URL`. A non-production build
 * disallows everything so the dev site never competes with ishqnama.com in search results.
 * Only production points crawlers to `sitemap.xml`.
 * robots.txt only asks well-behaved crawlers to stay away; it is not access control.
 */
export function robotsFor(origin: URL = siteUrl()): MetadataRoute.Robots {
  if (!PRODUCTION_HOSTS.has(origin.hostname)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
    sitemap: new URL("/sitemap.xml", origin).href,
  };
}
