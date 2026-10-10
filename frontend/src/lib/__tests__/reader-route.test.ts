import { describe, expect, it } from "vitest";
import { isReaderRoute } from "@/lib/reader-route";

describe("isReaderRoute", () => {
  it("treats chapter, ruku and juz pages as reader routes", () => {
    expect(isReaderRoute("/quran/1/")).toBe(true);
    expect(isReaderRoute("/quran/2/ruku/3/")).toBe(true);
    expect(isReaderRoute("/quran/juz/30/")).toBe(true);
    expect(isReaderRoute("/quran/juz/1/ruku/2/")).toBe(true);
  });

  it("treats an essay page as a reader route, but not the articles index", () => {
    expect(isReaderRoute("/articles/nooreimaan/naskh/")).toBe(true);
    expect(isReaderRoute("/articles/")).toBe(false);
    expect(isReaderRoute("/articles/nooreimaan/")).toBe(false);
  });

  it("excludes the chapter index and every other page", () => {
    expect(isReaderRoute("/quran/")).toBe(false);
    expect(isReaderRoute("/")).toBe(false);
    expect(isReaderRoute("/about/")).toBe(false);
    expect(isReaderRoute("/library/")).toBe(false);
  });

  it("handles a missing pathname", () => {
    expect(isReaderRoute(null)).toBe(false);
    expect(isReaderRoute(undefined)).toBe(false);
  });
});
