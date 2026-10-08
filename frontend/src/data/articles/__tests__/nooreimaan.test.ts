import { describe, expect, it } from "vitest";
import {
  NOOR_E_IMAAN_ESSAYS,
  NOOR_E_IMAAN_ESSAY_BY_SLUG,
  essayNeighbours,
  essayPath,
} from "@/data/articles/nooreimaan";

describe("Noor e Imaan essay manifest", () => {
  it("lists the 22 essays in book order, from the Quran's coherence to amanat", () => {
    expect(NOOR_E_IMAAN_ESSAYS).toHaveLength(22);
    expect(NOOR_E_IMAAN_ESSAYS[0].slug).toBe("is-the-quran-connected");
    expect(NOOR_E_IMAAN_ESSAYS[21].slug).toBe("amanat");
  });

  it("gives every essay a unique kebab-case slug and a unique Urdu title", () => {
    const slugs = NOOR_E_IMAAN_ESSAYS.map((e) => e.slug);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(NOOR_E_IMAAN_ESSAYS.map((e) => e.urduTitle)).size).toBe(22);
  });

  it("leaves out the dua, which has its own page", () => {
    expect(NOOR_E_IMAAN_ESSAYS.some((e) => e.urduTitle.includes("دعاء ختم"))).toBe(false);
  });

  it("looks essays up by slug and builds their paths", () => {
    expect(NOOR_E_IMAAN_ESSAY_BY_SLUG.get("naskh")?.urduTitle).toBe("نسخ");
    expect(essayPath("naskh")).toBe("/articles/nooreimaan/naskh/");
  });

  it("finds neighbours in book order, with none past either end", () => {
    expect(essayNeighbours("is-the-quran-connected")).toEqual({
      previous: null,
      next: NOOR_E_IMAAN_ESSAYS[1],
    });
    expect(essayNeighbours("amanat")).toEqual({ previous: NOOR_E_IMAAN_ESSAYS[20], next: null });
    expect(essayNeighbours("missing")).toEqual({ previous: null, next: null });
  });
});
