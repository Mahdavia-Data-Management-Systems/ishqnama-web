import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import index from "@/data/articles/nooreimaan-reflections.json";
import { NOOR_E_IMAAN_ESSAY_BY_SLUG, essayReflections, reflectionsStaticParams } from "@/data/articles/nooreimaan";

// The essay files the API embeds, which the index is derived from.
const ESSAYS_DIR = path.resolve(__dirname, "../../../../backend/src/Ishqnama.Application/Articles/NoorEImaan");

function reflectionsInEssayFiles(): Record<string, unknown[]> {
  const found: Record<string, unknown[]> = {};
  for (const file of readdirSync(ESSAYS_DIR).filter((f) => f.endsWith(".json")).sort()) {
    const essay = JSON.parse(readFileSync(path.join(ESSAYS_DIR, file), "utf-8")) as { reflections?: unknown[] };
    if (essay.reflections?.length) found[file.replace(/\.json$/, "")] = essay.reflections;
  }
  return found;
}

describe("the reflections index", () => {
  it("matches the essay files, so a reflection added to an essay reaches the static pages", () => {
    // Regenerate with `npm run articles:build`, or any `diarize_podcast.py --release/--attach … --article`.
    expect(index).toEqual(reflectionsInEssayFiles());
  });

  it("names only essays in the manifest", () => {
    for (const slug of Object.keys(index)) expect(NOOR_E_IMAAN_ESSAY_BY_SLUG.has(slug)).toBe(true);
  });

  it("gives a reflections page to exactly the essays with recordings, in book order", () => {
    const slugs = reflectionsStaticParams().map((p) => p.slug);
    expect(slugs.sort()).toEqual(Object.keys(index).sort());
    expect(essayReflections("naskh").length).toBeGreaterThan(0);
    expect(essayReflections("amanat")).toEqual([]);
    expect(essayReflections("not-an-essay")).toEqual([]);
  });
});
