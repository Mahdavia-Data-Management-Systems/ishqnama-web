import { suras } from "@/data/suras";

/**
 * Where a shared verse link opens: the verse's chapter or its ruku within the
 * juz. Each is a page the reader already serves. The chapter link carries a
 * `?verse=` query that scrolls to and flashes the verse once the page has
 * loaded; the ruku link opens the ruku itself, from its first verse, since a
 * ruku is short enough to be shared as a passage.
 */
export type ShareTarget =
  | { kind: "chapter"; chapter: number; verse: number }
  | { kind: "ruku"; juz: number; rankInJuz: number; chapter: number; verse: number };

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

const BOOK_NAME = "Noor-e-Imaan";

export function chapterName(chapter: number): string {
  return suras.find((s) => s.number === chapter)?.name ?? `Chapter ${chapter}`;
}

/** "al-Baqarah 2:255", or "al-Baqarah 2" for the bismillah (verse 0). */
export function verseReference(chapter: number, verse: number): string {
  const ref = verse > 0 ? `${chapter}:${verse}` : `${chapter}`;
  return `${chapterName(chapter)} ${ref}`;
}

export function buildShareUrl(origin: string, target: ShareTarget): string {
  switch (target.kind) {
    case "chapter": {
      const query = target.verse > 0 ? `?verse=${target.verse}` : "";
      return `${origin}/quran/${target.chapter}/${query}`;
    }
    case "ruku":
      return `${origin}/quran/juz/${target.juz}/ruku/${target.rankInJuz}/`;
  }
}

interface ShareTextInput {
  target: ShareTarget;
  translation: string | undefined;
}

/**
 * The first line of the message: the book, the verse reference and, when the link
 * opens from the ruku, that place too, e.g.
 * "Noor-e-Imaan | al-Baqarah 2:255 | Juz 3, Ruku 1".
 */
export function shareHeading(target: ShareTarget): string {
  const parts = [BOOK_NAME, verseReference(target.chapter, target.verse)];
  if (target.kind === "ruku") parts.push(`Juz ${target.juz}, Ruku ${target.rankInJuz}`);
  return parts.join(" | ");
}

/**
 * The shared message: heading, then the translation (never the Arabic), ending in a
 * newline so whatever is appended after it starts on its own line. The link is
 * deliberately not part of it: the system share carries it in `url`, and share
 * targets append that to the text themselves, so including it here printed it twice.
 */
export function buildShareText({ target, translation }: ShareTextInput): string {
  const lines = [shareHeading(target)];
  const body = translation?.trim();
  if (body) lines.push(body);
  return `${lines.join("\n")}\n`;
}

interface SharePayload {
  title: string;
  text: string;
  url: string;
}

/**
 * Hands the verse to the system share sheet where the browser has one, otherwise
 * copies the text with the link appended to the clipboard.
 */
export async function shareVerse(payload: SharePayload): Promise<ShareOutcome> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
      // Some browsers refuse the share (e.g. not from a user gesture); fall through to copying.
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
