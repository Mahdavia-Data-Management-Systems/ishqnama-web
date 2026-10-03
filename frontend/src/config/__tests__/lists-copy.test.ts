import { describe, expect, it } from "vitest";
import {
  DEV_FEATURED_LIST_IDS,
  LOCAL_FEATURED_LIST_IDS,
  PRODUCTION_FEATURED_LIST_IDS,
  featuredListIdsFor,
} from "@/config/featured-lists";
import { LISTS_COPY } from "@/config/lists-copy";

// Same rule as the sign-in and readiness copy: readers are often unfamiliar with technology.
const BANNED = /(service|\bapi\b|server|account|log in|authenticat|session|database|\bid\b)/i;

describe("lists copy", () => {
  it("uses no technical words", () => {
    for (const s of Object.values(LISTS_COPY)) expect(s, s).not.toMatch(BANNED);
  });

  it("starts every string with a capital", () => {
    for (const s of Object.values(LISTS_COPY)) expect(s[0], s).toBe(s[0].toUpperCase());
  });
});

describe("featured lists", () => {
  it.each([
    ["production", PRODUCTION_FEATURED_LIST_IDS],
    ["dev", DEV_FEATURED_LIST_IDS],
    ["local", LOCAL_FEATURED_LIST_IDS],
  ])("holds only list ids, each once, for %s", (_, ids) => {
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("picks the array for the site the build is served from", () => {
    expect(featuredListIdsFor(new URL("https://ishqnama.com"))).toBe(PRODUCTION_FEATURED_LIST_IDS);
    expect(featuredListIdsFor(new URL("https://www.ishqnama.com"))).toBe(PRODUCTION_FEATURED_LIST_IDS);
    expect(featuredListIdsFor(new URL("https://dev.ishqnama.com"))).toBe(DEV_FEATURED_LIST_IDS);
    expect(featuredListIdsFor(new URL("http://localhost:3000"))).toBe(LOCAL_FEATURED_LIST_IDS);
    expect(featuredListIdsFor(new URL("http://127.0.0.1:3000"))).toBe(LOCAL_FEATURED_LIST_IDS);
  });
});
