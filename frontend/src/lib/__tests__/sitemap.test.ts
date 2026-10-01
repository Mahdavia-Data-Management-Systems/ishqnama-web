import { describe, expect, it } from "vitest";
import { RUKUS } from "@/data/rukus";
import { DISALLOWED_PATHS } from "../robots";
import { sitemapFor, sitemapPaths } from "../sitemap";

describe("sitemapPaths", () => {
  const paths = sitemapPaths();

  it("lists every chapter and juz", () => {
    expect(paths).toContain("/quran/1/");
    expect(paths).toContain("/quran/114/");
    expect(paths).toContain("/quran/juz/30/");
    expect(paths.filter((p) => /^\/quran\/\d+\/$/.test(p))).toHaveLength(114);
    expect(paths.filter((p) => /^\/quran\/juz\/\d+\/$/.test(p))).toHaveLength(30);
  });

  it("lists chapter rukus only for chapters with more than one", () => {
    expect(paths).toContain("/quran/2/ruku/40/");
    expect(paths).not.toContain("/quran/1/ruku/1/");
    expect(paths).not.toContain("/quran/114/ruku/1/");
    const multi = RUKUS.filter((r) => RUKUS.filter((o) => o.chapterNumber === r.chapterNumber).length > 1);
    expect(paths.filter((p) => p.includes("/ruku/"))).toHaveLength(multi.length);
  });

  it("leaves out juz ruku pages, which repeat chapter rukus", () => {
    expect(paths.some((p) => p.startsWith("/quran/juz/") && p.includes("/ruku/"))).toBe(false);
  });

  it("never lists a path robots.txt disallows", () => {
    expect(paths.filter((p) => DISALLOWED_PATHS.some((d) => p.startsWith(d)))).toEqual([]);
  });

  it("has no duplicates and every path ends with a slash", () => {
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.every((p) => p.endsWith("/"))).toBe(true);
  });
});

describe("sitemapFor", () => {
  it("makes every URL absolute on the given origin", () => {
    const entries = sitemapFor(new URL("https://ishqnama.com"));
    expect(entries[0]).toEqual({ url: "https://ishqnama.com/" });
    expect(entries.every((e) => e.url.startsWith("https://ishqnama.com/"))).toBe(true);
  });
});
