import { describe, expect, it } from "vitest";
import {
  arrangeSavedLists,
  groupReaderPath,
  groupReference,
  idsToFetch,
  initials,
  isValidGroup,
  listViewPath,
  rukuEndsInChapter,
} from "../verse-lists";
import { buildListShareText } from "../share-list";
import type { FavoriteDto, VerseListSummaryDto } from "@/types/lists";

function summary(id: string, title = id): VerseListSummaryDto {
  return { id, title, description: null, ownerName: "Noor", status: "published", groupCount: 1, updatedAt: "" };
}

function favorite(listId: string, title = listId): FavoriteDto {
  return { id: `fav_list_${listId}`, kind: "list", listId, title, createdAt: "" };
}

describe("groups", () => {
  it("must be a range within one chapter", () => {
    expect(isValidGroup({ chapter: 2, fromVerse: 255, toVerse: 257 })).toBe(true);
    expect(isValidGroup({ chapter: 2, fromVerse: 1, toVerse: 286 })).toBe(true);
    expect(isValidGroup({ chapter: 1, fromVerse: 1, toVerse: 8 })).toBe(false); // runs past al-Fātiḥah
    expect(isValidGroup({ chapter: 2, fromVerse: 0, toVerse: 3 })).toBe(false);
    expect(isValidGroup({ chapter: 2, fromVerse: 5, toVerse: 3 })).toBe(false);
    expect(isValidGroup({ chapter: 115, fromVerse: 1, toVerse: 1 })).toBe(false);
  });

  it("are named by chapter and verses", () => {
    expect(groupReference({ chapter: 2, fromVerse: 255, toVerse: 257 })).toBe("al-Baqarah 2:255–257");
    expect(groupReference({ chapter: 1, fromVerse: 5, toVerse: 5 })).toBe("al-Fātiḥah 1:5");
  });

  it("open the reader at their first verse", () => {
    expect(groupReaderPath({ chapter: 2, fromVerse: 255 })).toBe("/quran/2/?verse=255");
  });

  it("know where rukus end, for the ruku marks", () => {
    const ends = rukuEndsInChapter(2);
    expect(ends.has(7)).toBe(true); // al-Baqarah's first ruku is 7 verses
    expect(ends.has(286)).toBe(true);
    expect(ends.has(8)).toBe(false);
  });
});

describe("list links and sharing", () => {
  it("puts the id in the query, since the site is exported as static pages", () => {
    expect(listViewPath("k3Jd9QxP2mWa")).toBe("/lists/view/?id=k3Jd9QxP2mWa");
  });

  it("shares the title, and the description on its own line", () => {
    expect(buildListShareText({ title: "Verses to memorise", description: null })).toBe("Verses to memorise");
    expect(buildListShareText({ title: "T", description: "D" })).toBe("T\nD");
  });
});

describe("initials", () => {
  it("takes the first and last names", () => {
    expect(initials("Noor Mahdi")).toBe("NM");
    expect(initials("  noor  ")).toBe("N");
    expect(initials("Syed Noor Mahdi")).toBe("SM");
    expect(initials("")).toBe("");
  });
});

describe("arrangeSavedLists", () => {
  it("shows each list in one section only", () => {
    const sections = arrangeSavedLists({
      mine: [summary("mine00000001")],
      featuredIds: ["feat00000001", "mine00000001", "gone00000001"],
      favorites: [favorite("feat00000001"), favorite("othr00000001"), favorite("mine00000001"), favorite("lost00000001", "Lost")],
      available: [summary("feat00000001"), summary("othr00000001")],
    });

    expect(sections.mine.map((l) => l.id)).toEqual(["mine00000001"]);
    // My own list stays mine even when featured; a featured list that is gone is left out
    expect(sections.featured.map((l) => l.id)).toEqual(["feat00000001"]);
    // A featured favourite shows only under Featured; an unavailable one stays, without a summary
    expect(sections.others.map((o) => [o.favorite.listId, o.summary?.id ?? null])).toEqual([
      ["othr00000001", "othr00000001"],
      ["lost00000001", null],
    ]);
  });

  it("fetches each featured or favourite id once", () => {
    expect(idsToFetch(["a", "b"], [favorite("b"), favorite("c")])).toEqual(["a", "b", "c"]);
  });
});
