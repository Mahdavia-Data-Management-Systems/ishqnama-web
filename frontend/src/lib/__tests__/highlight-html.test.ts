import { describe, expect, it } from "vitest";
import { escapeRegExp, highlightHtml } from "@/lib/highlight-html";

describe("highlightHtml", () => {
  it("marks every match, whatever its case", () => {
    expect(highlightHtml("Mercy and mercy", "MERCY", "hl")).toBe(
      '<mark class="hl">Mercy</mark> and <mark class="hl">mercy</mark>',
    );
  });

  it("leaves tags and their attributes untouched", () => {
    expect(highlightHtml('<span lang="ar">lang</span> of lang', "lang", "hl")).toBe(
      '<span lang="ar"><mark class="hl">lang</mark></span> of <mark class="hl">lang</mark>',
    );
  });

  it("treats regular expression characters in the query as plain text", () => {
    expect(highlightHtml("a (b) c.d", "(b)", "hl")).toBe('a <mark class="hl">(b)</mark> c.d');
    expect(highlightHtml("abc", ".", "hl")).toBe("abc");
  });

  it("returns the input when there is nothing to look for", () => {
    expect(highlightHtml("<b>text</b>", "", "hl")).toBe("<b>text</b>");
  });
});

describe("escapeRegExp", () => {
  it("escapes every metacharacter", () => {
    expect(new RegExp(escapeRegExp(".*+?^${}()|[]\\")).test(".*+?^${}()|[]\\")).toBe(true);
  });
});
