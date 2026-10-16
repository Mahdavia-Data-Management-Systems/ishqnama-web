import { describe, expect, it } from "vitest";
import {
  chapterAudioUrl,
  clipFor,
  listPlaylist,
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
    expect(chapterAudioUrl(tiny, 2)).toBe("https://audio.ishqnama.com/recitations/test-reciter/v3/002.mp3");
    expect(chapterAudioUrl(ABDUL_BASIT_MURATTAL, 114)).toBe(
      "https://audio.ishqnama.com/recitations/abdul-basit-murattal/v1/114.mp3",
    );
  });
});

describe("clipFor", () => {
  it("reads a numbered verse out of its own chapter's file", () => {
    expect(clipFor(tiny, 2, 2)).toEqual({
      url: "https://audio.ishqnama.com/recitations/test-reciter/v3/002.mp3",
      fromMs: 6200,
      toMs: 12000,
      title: "al-Baqarah",
      subtitle: "Verse 2",
      ref: { chapter: 2, verse: 2 },
    });
  });

  it("plays verse 0 of any chapter but 9 as the basmala from chapter 1's file", () => {
    const clip = clipFor(tiny, 2, 0);
    expect(clip.url).toBe("https://audio.ishqnama.com/recitations/test-reciter/v3/001.mp3");
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

const tinyOption = { name: "A test reciter - Murattal", reciter: "A test reciter", timings: tiny };

describe("versePlaylist", () => {
  it("keeps the verses in the order given, across chapters, with the id, href and reciter", () => {
    const p = versePlaylist(
      "juz/1",
      [{ chapter: 1, verse: 2 }, { chapter: 2, verse: 0 }, { chapter: 2, verse: 1 }],
      "/quran/juz/1/",
      tinyOption,
    );
    expect(p.id).toBe("juz/1");
    expect(p.href).toBe("/quran/juz/1/");
    expect(p.reciter).toBe("A test reciter");
    expect(p.clips.map((c) => c.ref)).toEqual([
      { chapter: 1, verse: 2 }, { chapter: 2, verse: 0 }, { chapter: 2, verse: 1 },
    ]);
    expect(p.clips[1].url).toMatch(/001\.mp3$/);
    expect(p.clips[2].url).toMatch(/002\.mp3$/);
  });

  it("leaves out a verse the recitation cannot serve instead of failing the page", () => {
    const p = versePlaylist(
      "quran/2",
      [{ chapter: 2, verse: 0 }, { chapter: 2, verse: 1 }, { chapter: 2, verse: 3 }, { chapter: 9, verse: 0 }],
      "/quran/2/",
      tinyOption,
    );
    expect(p.clips.map((c) => c.ref)).toEqual([{ chapter: 2, verse: 0 }, { chapter: 2, verse: 1 }]);
  });

  it("uses the default recitation, Mishari al-Afasy, when none is given", () => {
    const p = versePlaylist("quran/112", [{ chapter: 112, verse: 1 }]);
    expect(p.clips[0].url).toBe("https://audio.ishqnama.com/recitations/mishari-rashid-al-afasy-murattal/v1/112.mp3");
    expect(p.clips[0].title).toBe("al-Ikhlāṣ");
    expect(p.reciter).toBe("Mishari Rashid al-Afasy");
  });
});

describe("listPlaylist", () => {
  const nine: RecitationTimings = {
    ...tiny,
    chapters: [...tiny.chapters, [], [], [], [], [], [], [[1, 0, 5000], [2, 5000, 9000], [5, 9000, 12000], [6, 12000, 15000]]],
  };
  const option = { name: "A test reciter - Murattal", reciter: "A test reciter", timings: nine };

  it("opens every group with its bismillah, then its verses in order, and says which group each clip is in", () => {
    const { playlist, groupOfClip } = listPlaylist(
      "list/abc",
      [{ chapter: 2, fromVerse: 1, toVerse: 2 }, { chapter: 1, fromVerse: 2, toVerse: 2 }],
      "/lists/view/?id=abc",
      option,
    );
    expect(playlist.id).toBe("list/abc");
    expect(playlist.href).toBe("/lists/view/?id=abc");
    expect(playlist.reciter).toBe("A test reciter");
    expect(playlist.clips.map((c) => `${c.ref!.chapter}:${c.ref!.verse}`)).toEqual(["2:0", "2:1", "2:2", "1:0", "1:2"]);
    expect(playlist.clips[0].subtitle).toBe("Bismillah");
    expect(playlist.clips[0].url).toMatch(/001\.mp3$/);
    expect(groupOfClip).toEqual([0, 0, 0, 1, 1]);
  });

  it("recites the bismillah a group of at-Tawbah shows, and leaves it off the group that opens the sura", () => {
    const { playlist, groupOfClip } = listPlaylist(
      "list/t",
      [{ chapter: 9, fromVerse: 1, toVerse: 2 }, { chapter: 9, fromVerse: 5, toVerse: 6 }],
      undefined,
      option,
    );
    expect(playlist.clips.map((c) => `${c.ref!.chapter}:${c.ref!.verse}`)).toEqual(["9:1", "9:2", "9:0", "9:5", "9:6"]);
    expect(playlist.clips[2].url).toMatch(/001\.mp3$/);
    expect(playlist.clips[2].title).toBe(playlist.clips[3].title);
    expect(groupOfClip).toEqual([0, 0, 1, 1, 1]);
  });

  it("skips a verse the recitation cannot serve without losing its group's place", () => {
    const { playlist, groupOfClip } = listPlaylist(
      "list/x",
      [{ chapter: 2, fromVerse: 2, toVerse: 3 }],
      undefined,
      option,
    );
    expect(playlist.clips.map((c) => c.ref!.verse)).toEqual([0, 2]);
    expect(groupOfClip).toEqual([0, 0]);
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
