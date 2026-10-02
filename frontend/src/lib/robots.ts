import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/page-metadata";

/** Hosts search engines may crawl. Every other environment (dev.ishqnama.com) is kept out. */
const PRODUCTION_HOSTS = new Set(["ishqnama.com", "www.ishqnama.com"]);

/**
 * Routes with nothing worth indexing: the MSAL redirect bridge, the signed-in Saved page,
 * search, whose results need an account and whose empty shell would only be a thin page, and
 * readers' verse lists, which are their own content shared by link, not pages of the site.
 */
export const DISALLOWED_PATHS = ["/redirect/", "/saved/", "/search/", "/lists/"];

/**
 * AI crawlers kept out of the whole site: model training, AI search and answer engines, and the
 * fetchers assistants use when a reader pastes a link. A crawler obeys only the most specific
 * group naming it, so these never fall through to the `*` group. Search engines (Googlebot,
 * Bingbot) and link-preview fetchers (facebookexternalhit, WhatsApp, Twitterbot, Slackbot) are
 * deliberately absent. Google-Extended and Applebot-Extended are not crawlers but opt-out tokens
 * Google and Apple read for AI use of pages their search crawlers fetch.
 */
export const AI_CRAWLERS = [
  // OpenAI
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  // Anthropic
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Claude-Web",
  "anthropic-ai",
  // Google, Apple
  "Google-Extended",
  "Applebot-Extended",
  // Meta
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "FacebookBot",
  // Perplexity
  "PerplexityBot",
  "Perplexity-User",
  // Others
  "Amazonbot",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "cohere-training-data-crawler",
  "Diffbot",
  "DuckAssistBot",
  "MistralAI-User",
  "AI2Bot",
  "Ai2Bot-Dolma",
  "YouBot",
  "Timpibot",
  "ImagesiftBot",
  "Omgilibot",
  "omgili",
  "Webzio-Extended",
  "PanguBot",
  "Kangaroo Bot",
  "iaskspider",
  "img2dataset",
];

/**
 * Rules for `robots.txt`, fixed at build time from `NEXT_PUBLIC_SITE_URL`. A non-production build
 * disallows everything so the dev site never competes with ishqnama.com in search results.
 * Production shuts out every crawler in `AI_CRAWLERS` and points the rest to `sitemap.xml`.
 * robots.txt only asks well-behaved crawlers to stay away; it is not access control.
 */
export function robotsFor(origin: URL = siteUrl()): MetadataRoute.Robots {
  if (!PRODUCTION_HOSTS.has(origin.hostname)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: [
      { userAgent: AI_CRAWLERS, disallow: "/" },
      { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
    ],
    sitemap: new URL("/sitemap.xml", origin).href,
  };
}
