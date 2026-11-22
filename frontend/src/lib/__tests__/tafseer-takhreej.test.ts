import { describe, expect, it } from "vitest";
import { citationsFor, flattenTakhreej, splitTakhreej, year, type TakhreejPart } from "@/lib/tafseer-takhreej";
import type { TakhreejBlockDto } from "@/types/api";

const ZWJ = "‍";

describe("splitTakhreej", () => {
  it("returns nothing for an empty explanation", () => {
    expect(splitTakhreej("")).toEqual([]);
  });

  it("returns the prose as it is when nothing is cited", () => {
    const html = 'یہ <span lang="ar">الم</span> ہے۔';
    expect(splitTakhreej(html)).toEqual([{ kind: "html", html }]);
  });

  it("splits a marked passage with a numbered anchor from the prose around it", () => {
    expect(splitTakhreej('پہلے <mark>اللہ کے راز ہیں ۔<ins data-takhreej="1"></ins></mark> بعد')).toEqual([
      { kind: "html", html: "پہلے " },
      { kind: "takhreej", passageHtml: "اللہ کے راز ہیں ۔", ordinal: 1 },
      { kind: "html", html: " بعد" },
    ]);
  });

  it("numbers several passages in one explanation in text order", () => {
    const parts = splitTakhreej(
      'ا <mark>ب<ins data-takhreej="1"></ins></mark> ج <mark>د<ins data-takhreej="2"></ins></mark>',
    );
    expect(parts.filter((p) => p.kind === "takhreej")).toEqual([
      { kind: "takhreej", passageHtml: "ب", ordinal: 1 },
      { kind: "takhreej", passageHtml: "د", ordinal: 2 },
    ]);
    expect(parts).toHaveLength(4);
  });

  it("keeps the spaces at a passage's edges in the prose", () => {
    expect(splitTakhreej('ا<mark> ب <ins data-takhreej="1"></ins> </mark>ج')).toEqual([
      { kind: "html", html: "ا " },
      { kind: "takhreej", passageHtml: "ب", ordinal: 1 },
      { kind: "html", html: "  ج" },
    ]);
  });

  it("gives a mark that holds only its anchor an empty passage", () => {
    expect(splitTakhreej('متن <mark><ins data-takhreej="1"></ins></mark> باقی')).toEqual([
      { kind: "html", html: "متن " },
      { kind: "takhreej", passageHtml: "", ordinal: 1 },
      { kind: "html", html: " باقی" },
    ]);
  });

  it("reads the citation lines of the older form, whose anchor closes on its own line", () => {
    const html =
      `<mark>اللہ کے راز ہیں ۔<ins>تفسير البغوي، ٥١٦ه — ١/٥٩ (ط. طيبة)${ZWJ}\n` +
      `معاني القرآن وإعرابه، الزجاج ٣١١ه — ١/٥٦${ZWJ}\n</ins></mark>`;
    expect(splitTakhreej(html)).toEqual([
      {
        kind: "takhreej",
        passageHtml: "اللہ کے راز ہیں ۔",
        inlineLines: ["تفسير البغوي، ٥١٦ه — ١/٥٩ (ط. طيبة)", "معاني القرآن وإعرابه، الزجاج ٣١١ه — ١/٥٦"],
      },
    ]);
  });

  it("reads lines when the anchor closes mid-line or ends the text", () => {
    expect(splitTakhreej("<mark>متن<ins>\nکتاب ایک\nکتاب دو</ins> اور</mark>")).toEqual([
      { kind: "takhreej", passageHtml: "متن اور", inlineLines: ["کتاب ایک", "کتاب دو"] },
    ]);
    expect(splitTakhreej("متن <ins>کتاب ایک</ins>")).toEqual([
      { kind: "html", html: "متن " },
      { kind: "takhreej", passageHtml: "", inlineLines: ["کتاب ایک"] },
    ]);
  });

  it("splits lines on Windows line endings", () => {
    const [part] = splitTakhreej("<mark>متن<ins>کتاب ایک\r\nکتاب دو\r\n</ins></mark>");
    expect(part).toMatchObject({ inlineLines: ["کتاب ایک", "کتاب دو"] });
  });

  it("drops a trailing comma but keeps the one between title and author", () => {
    const [part] = splitTakhreej("<mark>متن<ins>جامع البيان، ابن جرير الطبري ٣١٠ه,\nالكشاف،\n</ins></mark>");
    expect(part).toMatchObject({ inlineLines: ["جامع البيان، ابن جرير الطبري ٣١٠ه", "الكشاف"] });
  });

  it("keeps both the number and the lines when an anchor has both", () => {
    expect(splitTakhreej('<mark>متن<ins data-takhreej="2">کتاب</ins></mark>')).toEqual([
      { kind: "takhreej", passageHtml: "متن", ordinal: 2, inlineLines: ["کتاب"] },
    ]);
  });

  it("reads a bare anchor outside any mark as sources with no passage", () => {
    expect(splitTakhreej('متن <ins data-takhreej="3"></ins> باقی')).toEqual([
      { kind: "html", html: "متن " },
      { kind: "takhreej", passageHtml: "", ordinal: 3 },
      { kind: "html", html: " باقی" },
    ]);
  });

  it("drops an empty anchor, inside a mark or outside one", () => {
    expect(splitTakhreej("ا <mark>ب<ins></ins></mark> ج")).toEqual([{ kind: "html", html: "ا ب ج" }]);
    expect(splitTakhreej(`ا <ins>${ZWJ}\n</ins>ج`)).toEqual([{ kind: "html", html: "ا ج" }]);
  });

  it("reads a mark without an anchor as plain prose", () => {
    expect(splitTakhreej("ا <mark>ب</mark> ج")).toEqual([{ kind: "html", html: "ا ب ج" }]);
  });

  it("keeps language spans in the passage and strips them from the citation lines", () => {
    const html =
      '<mark>کہا <span lang="ar">قد فعلت</span><ins><span lang="ar">صحيح مسلم</span> &amp; شرحه</ins></mark>';
    expect(splitTakhreej(html)).toEqual([
      {
        kind: "takhreej",
        passageHtml: 'کہا <span lang="ar">قد فعلت</span>',
        inlineLines: ["صحيح مسلم & شرحه"],
      },
    ]);
  });
});

describe("flattenTakhreej", () => {
  it("keeps the passage as prose and drops the marks, anchors and citation lines", () => {
    const html =
      'ا <mark>ب <span lang="ar">ت</span><ins data-takhreej="1"></ins></mark> ج <mark>د<ins>کتاب\n</ins></mark> ہ<ins>کتاب</ins>';
    const flat = flattenTakhreej(html);
    expect(flat).toBe('ا ب <span lang="ar">ت</span> ج د ہ');
    expect(flat).not.toMatch(/<\/?(mark|ins)\b/);
  });

  it("returns prose without citations unchanged", () => {
    expect(flattenTakhreej("صرف متن")).toBe("صرف متن");
    expect(flattenTakhreej("")).toBe("");
  });
});

describe("citationsFor", () => {
  const blocks: TakhreejBlockDto[] = [
    { ordinal: 1, citations: [{ title: "جامع البيان", author: "ابن جرير الطبري", authorDeathYearHijri: 310 }] },
    { ordinal: 2, citations: [{ title: "صحيح مسلم", reference: "ح٨" }] },
  ];

  it("returns the block the anchor names", () => {
    expect(citationsFor({ kind: "takhreej", passageHtml: "", ordinal: 2 }, blocks)).toEqual(blocks[1].citations);
  });

  it("prefers the block over lines the anchor still carries", () => {
    expect(
      citationsFor({ kind: "takhreej", passageHtml: "", ordinal: 1, inlineLines: ["کتاب"] }, blocks),
    ).toEqual(blocks[0].citations);
  });

  it("falls back to the anchor's lines when the segment has no such block", () => {
    const part: TakhreejPart = { kind: "takhreej", passageHtml: "", inlineLines: ["کتاب ایک"] };
    expect(citationsFor(part, blocks)).toEqual(["کتاب ایک"]);
    expect(citationsFor({ ...part, ordinal: 9 }, blocks)).toEqual(["کتاب ایک"]);
    expect(citationsFor(part, null)).toEqual(["کتاب ایک"]);
    expect(citationsFor(part)).toEqual(["کتاب ایک"]);
  });

  it("returns nothing when neither is there", () => {
    expect(citationsFor({ kind: "takhreej", passageHtml: "", ordinal: 5 }, blocks)).toEqual([]);
  });
});

describe("year", () => {
  it("prints the hijri year in Eastern Arabic digits with its mark", () => {
    expect(year(310)).toBe(`٣١٠ه${ZWJ}`);
    expect(year(1205)).toBe(`١٢٠٥ه${ZWJ}`);
  });
});
