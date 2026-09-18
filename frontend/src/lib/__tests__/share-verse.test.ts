import { afterEach, describe, expect, it, vi } from "vitest";
import { buildShareText, buildShareUrl, shareVerse } from "@/lib/share-verse";

const origin = "https://www.ishqnama.com";

describe("buildShareUrl", () => {
  it("links a verse from its chapter", () => {
    expect(buildShareUrl(origin, { kind: "chapter", chapter: 2, verse: 255 })).toBe(
      "https://www.ishqnama.com/quran/2/?verse=255",
    );
  });

  it("links the ruku itself, with no verse query, when shared from its ruku", () => {
    expect(buildShareUrl(origin, { kind: "ruku", juz: 3, rankInJuz: 1, chapter: 2, verse: 255 })).toBe(
      "https://www.ishqnama.com/quran/juz/3/ruku/1/",
    );
  });

  it("drops the verse query for the bismillah", () => {
    expect(buildShareUrl(origin, { kind: "chapter", chapter: 2, verse: 0 })).toBe(
      "https://www.ishqnama.com/quran/2/",
    );
  });
});

describe("buildShareText", () => {
  it("opens with the book name and reference, then the translation, with no Arabic or link", () => {
    const text = buildShareText({
      target: { kind: "chapter", chapter: 2, verse: 255 },
      translation: "Allah, there is no god but He, the Living, the Sustainer.",
    });
    expect(text).toBe(
      "Noor-e-Imaan | al-Baqarah 2:255\nAllah, there is no god but He, the Living, the Sustainer.\n",
    );
    expect(text).not.toMatch(/[؀-ۿ]/);
    expect(text).not.toMatch(/https?:/);
  });

  it("names the juz and ruku after the reference when shared from the ruku", () => {
    expect(
      buildShareText({
        target: { kind: "ruku", juz: 3, rankInJuz: 1, chapter: 2, verse: 255 },
        translation: "Body",
      }),
    ).toBe("Noor-e-Imaan | al-Baqarah 2:255 | Juz 3, Ruku 1\nBody\n");
  });

  it("is just the first line when there is no translation", () => {
    expect(
      buildShareText({ target: { kind: "chapter", chapter: 112, verse: 1 }, translation: undefined }),
    ).toBe("Noor-e-Imaan | al-Ikhlāṣ 112:1\n");
  });

  it("refers to the bismillah by chapter alone", () => {
    expect(
      buildShareText({ target: { kind: "chapter", chapter: 2, verse: 0 }, translation: "In the name of Allah" }),
    ).toBe("Noor-e-Imaan | al-Baqarah 2\nIn the name of Allah\n");
  });
});

describe("shareVerse", () => {
  afterEach(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  it("hands the system share sheet the link only through url, so targets do not print it twice", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    const result = await shareVerse({ title: "al-Baqarah 2:255", text: "body", url: "https://x/quran/2/?verse=255" });
    expect(result).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: "al-Baqarah 2:255", text: "body", url: "https://x/quran/2/?verse=255" });
    expect(share.mock.calls[0][0].text).not.toContain("https://x/");
  });

  it("reports a cancelled system share", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError")),
      configurable: true,
    });
    expect(await shareVerse({ title: "t", text: "b", url: "https://x/" })).toBe("cancelled");
  });

  it("copies the text with the link appended once when there is no system share", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    expect(await shareVerse({ title: "t", text: "body\n", url: "https://x/" })).toBe("copied");
    expect(writeText).toHaveBeenCalledWith("body\n\nhttps://x/");
  });

  it("reports failure when neither sharing nor copying is possible", async () => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    expect(await shareVerse({ title: "t", text: "b", url: "https://x/" })).toBe("failed");
  });
});
