import { describe, expect, it } from "vitest";
import {
  chapterAudioUrl,
  clipFor,
  versePlaylist,
  verseQuery,
  type RecitationTimings,
} from "@/lib/recitation-playlist";
import { ABDUL_BASIT_MURATTAL } from "@/data/recitations/abdul-basit-murattal";

const tiny: RecitationTimings = {
  id: "test-reciter",
  version: 3,
  basmala: [0, 4000],
  chapters: [
    [[1, 4000, 9000], [2, 9000, 14000]],
    [[1, 0, 6000], [2, 6200, 12000]],
  ],
};

describe("chapterAudioUrl", () => {
  it("builds the versioned, zero-padded path on the audio origin", () => {
    expect(chapterAudioUrl(tiny, 2)).toBe("https://audio.ishqnama.com/recitations/v3/test-reciter/002.mp3");
    expect(chapterAudioUrl(ABDUL_BASIT_MURATTAL, 114)).toBe(
      "https://audio.ishqnama.com/recitations/v1/abdul-basit-murattal/114.mp3",
    );
  });
});

describe("clipFor", () => {
  it("reads a numbered verse out of its own chapter's file", () => {
    expect(clipFor(tiny, 2, 2)).toEqual({
      url: "https://audio.ishqnama.com/recitations/v3/test-reciter/002.mp3",
      fromMs: 6200,
      toMs: 12000,
      title: "al-Baqarah",
      subtitle: "Verse 2",
      ref: { chapter: 2, verse: 2 },
    });
  });

  it("plays verse 0 of any chapter but 9 as the basmala from chapter 1's file", () => {
    const clip = clipFor(tiny, 2, 0);
    expect(clip.url).toBe("https://audio.ishqnama.com/recitations/v3/test-reciter/001.mp3");
    expect(clip.fromMs).toBe(0);
    expect(clip.toMs).toBe(4000);
    expect(clip.subtitle).toBe("Bismillah");
    expect(clip.ref).toEqual({ chapter: 2, verse: 0 });
    expect(clipFor(tiny, 1, 0).url).toBe(clip.url);
  });

  it("refuses verse 0 of chapter 9 and verses that do not exist", () => {
    expect(() => clipFor(ABDUL_BASIT_MURATTAL, 9, 0)).toThrow(/9:0/);
    expect(() => clipFor(tiny, 2, 3)).toThrow(/2:3/);
  });
});

describe("versePlaylist", () => {
  it("keeps the verses in the order given, across chapters, with the id and href", () => {
    const p = versePlaylist(
      "juz/1",
      [{ chapter: 1, verse: 2 }, { chapter: 2, verse: 0 }, { chapter: 2, verse: 1 }],
      "/quran/juz/1/",
      tiny,
    );
    expect(p.id).toBe("juz/1");
    expect(p.href).toBe("/quran/juz/1/");
    expect(p.clips.map((c) => c.ref)).toEqual([
      { chapter: 1, verse: 2 }, { chapter: 2, verse: 0 }, { chapter: 2, verse: 1 },
    ]);
    expect(p.clips[1].url).toMatch(/001\.mp3$/);
    expect(p.clips[2].url).toMatch(/002\.mp3$/);
  });

  it("uses the bundled recitation by default", () => {
    const p = versePlaylist("quran/112", [{ chapter: 112, verse: 1 }]);
    expect(p.clips[0].url).toBe("https://audio.ishqnama.com/recitations/v1/abdul-basit-murattal/112.mp3");
    expect(p.clips[0].title).toBe("al-Ikhlāṣ");
  });
});

describe("verseQuery", () => {
  it("adds the verse to a chapter page as a bare number and elsewhere as chapter-verse", () => {
    expect(verseQuery({ chapter: 2, verse: 255 }, "/quran/2/")).toBe("/quran/2/?verse=255");
    expect(verseQuery({ chapter: 2, verse: 255 }, "/quran/juz/3/")).toBe("/quran/juz/3/?verse=2-255");
    expect(verseQuery({ chapter: 2, verse: 255 }, "/lists/view/?id=abc123def456")).toBe(
      "/lists/view/?id=abc123def456&verse=2-255",
    );
  });
});
