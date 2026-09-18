import { suras } from "@/data/suras";

/**
 * Where a shared verse link opens: the verse's chapter, its juz, or its ruku
 * within the juz. Each is a page the reader already serves; the `?verse=`
 * query scrolls to and flashes the verse once the page has loaded.
 */
export type ShareTarget =
  | { kind: "chapter"; chapter: number; verse: number }
  | { kind: "juz"; juz: number; chapter: number; verse: number }
  | { kind: "ruku"; juz: number; rankInJuz: number; verse: number };

export type ShareOutcome = "shared" | "copied" | "cancelled" | "failed";

export function chapterName(chapter: number): string {
  return suras.find((s) => s.number === chapter)?.name ?? `Chapter ${chapter}`;
}

/** "al-Baqarah 2:255", or "al-Baqarah 2" for the bismillah (verse 0). */
export function verseReference(chapter: number, verse: number): string {
  const ref = verse > 0 ? `${chapter}:${verse}` : `${chapter}`;
  return `${chapterName(chapter)} ${ref}`;
}

export function buildShareUrl(origin: string, target: ShareTarget): string {
  let path: string;
  let verseParam: string;
  switch (target.kind) {
    case "chapter":
      path = `/quran/${target.chapter}/`;
      verseParam = `${target.verse}`;
      break;
    case "juz":
      path = `/quran/juz/${target.juz}/`;
      // A juz spans chapters, so verse numbers repeat; the reader accepts "chapter-verse" here.
      verseParam = `${target.chapter}-${target.verse}`;
      break;
    case "ruku":
      path = `/quran/juz/${target.juz}/ruku/${target.rankInJuz}/`;
      verseParam = `${target.verse}`;
      break;
  }
  const query = target.verse > 0 ? `?verse=${verseParam}` : "";
  return `${origin}${path}${query}`;
}

interface ShareTextInput {
  chapter: number;
  verse: number;
  translation: string | undefined;
}

/**
 * The shared message: reference, then the translation (never the Arabic). The link
 * is deliberately not part of it: the system share carries it in `url`, and share
 * targets append that to the text themselves, so including it here printed it twice.
 */
export function buildShareText({ chapter, verse, translation }: ShareTextInput): string {
  const lines = [verseReference(chapter, verse)];
  const body = translation?.trim();
  if (body) lines.push(body);
  return lines.join("\n");
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
      await navigator.clipboard.writeText(`${payload.text}\n\n${payload.url}`);
      return "copied";
    } catch {
      return "failed";
    }
  }
  return "failed";
}
