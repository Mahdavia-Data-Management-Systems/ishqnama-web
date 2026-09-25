import type { Metadata } from "next";
import { suras } from "@/data/suras";

/**
 * Link previews (WhatsApp, Facebook, X, Slack, iMessage...) come from Open Graph and Twitter
 * meta tags in the static HTML: crawlers do not run JavaScript, so every tag is fixed at build
 * time and every URL in them has to be absolute.
 */

export const SITE_NAME = "Ishqnama";

const DEFAULT_SITE_URL = "https://ishqnama.com";

/**
 * Origin the build is served from, baked in from `NEXT_PUBLIC_SITE_URL` (an SWA app setting per
 * environment, read by deploy-frontend.yml like the other NEXT_PUBLIC_ values). Anything that is
 * not an absolute http(s) URL, including the "null" jq prints for a missing setting, falls back to
 * production so previews never point at a relative image.
 */
export function siteUrl(value = process.env.NEXT_PUBLIC_SITE_URL): URL {
  try {
    const url = new URL(value ?? "");
    if (url.protocol === "https:" || url.protocol === "http:") return new URL(url.origin);
  } catch {
    // fall through
  }
  return new URL(DEFAULT_SITE_URL);
}

/** Rendered by `npm run og:image` (scripts/render-og-image.mjs). */
export const OG_IMAGE = {
  url: "/images/og-ishqnama.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: "Ishqnama: the Holy Quran with Noor e Imaan tarjuma and tafseer in Urdu, Hindi and English",
};

export const SITE_DESCRIPTION =
  "Read the Holy Quran with Urdu, Hindi and English tarjuma and the Noor e Imaan tafseer by Hazrath Peer-o-Murshid Syed Meeranji Abid Khundmiri Sahib.";

interface PageMetadataInput {
  /** Page title without the site name; omit for the home page. */
  title?: string;
  description: string;
  /** Route path with its trailing slash, e.g. "/quran/2/". */
  path: string;
}

/**
 * Title, description and the matching Open Graph and Twitter card for one page.
 *
 * Every page builds its whole `openGraph` and `twitter` objects here because Next.js replaces,
 * rather than merges, a parent segment's `openGraph` when a child sets its own: a page that only
 * set `openGraph.title` would lose the image.
 */
export function pageMetadata({ title, description, path }: PageMetadataInput): Metadata {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Noor e Imaan, The Holy Quran`;
  return {
    title: { absolute: fullTitle },
    description,
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en",
      url: path,
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [{ url: OG_IMAGE.url, alt: OG_IMAGE.alt }],
    },
  };
}

function suraOf(number: number) {
  return suras.find((s) => s.number === number);
}

/** "al-Baqarah (البقرة)", the chapter's name as the reader shows it. */
function suraTitle(number: number): string {
  const sura = suraOf(number);
  return sura ? `${sura.name} (${sura.arabicName})` : `Chapter ${number}`;
}

export function suraMetadata(number: number): Metadata {
  const sura = suraOf(number);
  const facts = sura
    ? `chapter ${number} of the Holy Quran, ${sura.verseCount} verses, ${sura.revelationType}`
    : `chapter ${number} of the Holy Quran`;
  return pageMetadata({
    title: `${suraTitle(number)}, Chapter ${number}`,
    description: `Read ${sura?.name ?? `chapter ${number}`}, ${facts}, with Urdu, Hindi and English tarjuma and the Noor e Imaan tafseer.`,
    path: `/quran/${number}/`,
  });
}

export function suraRukuMetadata(number: number, rank: number, totalRukus: number): Metadata {
  const name = suraOf(number)?.name ?? `Chapter ${number}`;
  return pageMetadata({
    title: `${suraTitle(number)}, Ruku ${rank}`,
    description: `Read ruku ${rank} of ${totalRukus} of ${name}, chapter ${number} of the Holy Quran, with Urdu, Hindi and English tarjuma and the Noor e Imaan tafseer.`,
    path: `/quran/${number}/ruku/${rank}/`,
  });
}

/** "al-Baqarah and Āl-ʿImrān": the chapters a juz runs through. */
function juzChapters(juz: number): string {
  const names = suras.filter((s) => s.juz.includes(juz)).map((s) => s.name);
  const last = names[names.length - 1];
  if (names.length > 3) return `${names[0]} to ${last}`;
  if (names.length > 1) return `${names.slice(0, -1).join(", ")} and ${last}`;
  return last ?? "";
}

export function juzMetadata(juz: number): Metadata {
  return pageMetadata({
    title: `Juz ${juz}`,
    description: `Read juz ${juz} of the Holy Quran (${juzChapters(juz)}) with Urdu, Hindi and English tarjuma and the Noor e Imaan tafseer.`,
    path: `/quran/juz/${juz}/`,
  });
}

export function juzRukuMetadata(juz: number, rank: number): Metadata {
  return pageMetadata({
    title: `Juz ${juz}, Ruku ${rank}`,
    description: `Read ruku ${rank} of juz ${juz} of the Holy Quran (${juzChapters(juz)}) with Urdu, Hindi and English tarjuma and the Noor e Imaan tafseer.`,
    path: `/quran/juz/${juz}/ruku/${rank}/`,
  });
}
