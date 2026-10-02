import { describe, expect, it } from "vitest";
import { FEATURED_LIST_IDS } from "@/config/featured-lists";
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
  it("holds only list ids, each once", () => {
    for (const id of FEATURED_LIST_IDS) expect(id).toMatch(/^[A-Za-z0-9]{12}$/);
    expect(new Set(FEATURED_LIST_IDS).size).toBe(FEATURED_LIST_IDS.length);
  });
});
