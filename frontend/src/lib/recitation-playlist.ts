import { RECITATION, RECITATION_AUDIO_ORIGIN, type RecitationOption } from "@/config/recitation";
import { suras } from "@/data/suras";
import { AUDIO_COPY } from "@/config/audio-copy";
import { showsBismillah } from "@/lib/verse-lists";
import type { VerseListGroupDto } from "@/types/lists";

/** Verse timings of one surah-by-surah recitation, as `scripts/build-recitation-timings.mjs` writes them. */
export interface RecitationTimings {
  id: string;
  version: number;
  /** [fromMs, toMs] of the basmala inside chapter 1's file; verse 0 of every chapter but 9. */
  basmala: [number, number];
  /** Index 0 is chapter 1. Rows are [verse, fromMs, toMs]; numbered verses only. */
  chapters: [number, number, number][][];
}

/** Something the player can play: a span of a file, or the whole file when from/to are omitted. */
export interface Clip {
  url: string;
  fromMs?: number;
  toMs?: number;
  /** What the bar shows: "al-Baqarah". */
  title: string;
  /** "Verse 255", "Bismillah". */
  subtitle?: string;
  /** Lets a page highlight the verse being read. */
  ref?: { chapter: number; verse: number };
}

export interface Playlist {
  /** Stable per page or list ("quran/2", "juz/3", "list/abc123def456"); the same id is the same playlist. */
  id: string;
  clips: Clip[];
  /** The page the playlist came from; the bar's title links back to it. */
  href?: string;
  /** Who is heard, for the lock screen; an essay recording may have no one to name. */
  reciter?: string;
}

export function chapterAudioUrl(recitation: RecitationTimings, chapter: number): string {
  return `${RECITATION_AUDIO_ORIGIN}/recitations/v${recitation.version}/${recitation.id}/${String(chapter).padStart(3, "0")}.mp3`;
}

function chapterName(chapter: number): string {
  return suras.find((s) => s.number === chapter)?.name ?? `Chapter ${chapter}`;
}

/**
 * The basmala, read from chapter 1's file, as verse 0 of `chapter`: what a page prints as ﷽
 * before that chapter's verses.
 */
function basmalaClip(recitation: RecitationTimings, chapter: number): Clip {
  const [fromMs, toMs] = recitation.basmala;
  return {
    url: chapterAudioUrl(recitation, 1), fromMs, toMs,
    title: chapterName(chapter), subtitle: AUDIO_COPY.bismillah, ref: { chapter, verse: 0 },
  };
}

/** The clip for one verse. Verse 0 is the basmala from chapter 1's file; chapter 9 has none. */
export function clipFor(recitation: RecitationTimings, chapter: number, verse: number): Clip {
  const title = chapterName(chapter);
  if (verse === 0) {
    if (chapter === 9) throw new Error("9:0 does not exist: chapter 9 has no basmala");
    return basmalaClip(recitation, chapter);
  }
  const row = recitation.chapters[chapter - 1]?.find(([v]) => v === verse);
  if (!row) throw new Error(`${chapter}:${verse} is not in the recitation`);
  const [, fromMs, toMs] = row;
  return { url: chapterAudioUrl(recitation, chapter), fromMs, toMs, title, subtitle: AUDIO_COPY.verse(verse), ref: { chapter, verse } };
}

/**
 * A playlist of the given verses in the given order; the caller decides what a page or list
 * holds. A verse the recitation cannot serve (chapter 9's verse 0, or one outside the table)
 * is left out rather than failing the page that builds its playlist; `clipFor` still throws
 * for an explicit request. Callers find a verse's clip by `ref`, never by counting.
 */
export function versePlaylist(
  id: string,
  verses: readonly { chapter: number; verse: number }[],
  href?: string,
  recitation: RecitationOption = RECITATION,
): Playlist {
  const clips: Clip[] = [];
  for (const v of verses) {
    try {
      clips.push(clipFor(recitation.timings, v.chapter, v.verse));
    } catch {
      // not in the recitation
    }
  }
  return { id, clips, href, reciter: recitation.reciter };
}

/**
 * A verse list's playlist: each group opens with the bismillah its header shows (every group but
 * one starting at at-Tawbah's first ayah, so a group from the middle of at-Tawbah is read with it
 * too, as printed), then its verses in order. `groupOfClip[i]` is the index into `groups` of
 * clip `i`, since two groups from one chapter share a chapter and the bismillah's verse 0, so
 * a page cannot tell them apart by ref alone.
 */
export function listPlaylist(
  id: string,
  groups: readonly Pick<VerseListGroupDto, "chapter" | "fromVerse" | "toVerse">[],
  href?: string,
  recitation: RecitationOption = RECITATION,
): { playlist: Playlist; groupOfClip: number[] } {
  const clips: Clip[] = [];
  const groupOfClip: number[] = [];
  groups.forEach((g, gi) => {
    if (showsBismillah(g)) {
      clips.push(basmalaClip(recitation.timings, g.chapter));
      groupOfClip.push(gi);
    }
    for (let v = g.fromVerse; v <= g.toVerse; v++) {
      try {
        clips.push(clipFor(recitation.timings, g.chapter, v));
        groupOfClip.push(gi);
      } catch {
        // not in the recitation
      }
    }
  });
  return { playlist: { id, clips, href, reciter: recitation.reciter }, groupOfClip };
}

/** The page link that opens on this verse: a bare number on a chapter page, chapter-verse elsewhere. */
export function verseQuery(ref: { chapter: number; verse: number }, href: string): string {
  const onChapterPage = /^\/quran\/\d+\/$/.test(href);
  const value = onChapterPage ? String(ref.verse) : `${ref.chapter}-${ref.verse}`;
  return `${href}${href.includes("?") ? "&" : "?"}verse=${value}`;
}
