import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureTranslationFont, translationFontFamily } from "@/lib/translation-font";

type FontsStub = { load: ReturnType<typeof vi.fn> };

function stubFonts(load: FontsStub["load"]) {
  Object.defineProperty(document, "fonts", { value: { load }, configurable: true });
}

describe("translationFontFamily", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--font-urdu");
    document.documentElement.style.removeProperty("--font-hindi");
  });

  it("takes the first family of the translation's font stack", () => {
    document.documentElement.style.setProperty(
      "--font-urdu",
      "'Jameel Noori Nastaleeq', 'Nafees Web Naskh', serif",
    );
    expect(translationFontFamily("urdu")).toBe("Jameel Noori Nastaleeq");
  });

  it("reads the family next/font injected", () => {
    document.documentElement.style.setProperty(
      "--font-hindi",
      '"Noto Serif Devanagari", "Noto Serif Devanagari Fallback", serif',
    );
    expect(translationFontFamily("hindi")).toBe("Noto Serif Devanagari");
  });

  it("falls back to the declared name when the variable is not set", () => {
    expect(translationFontFamily("urdu")).toBe("Jameel Noori Nastaleeq");
    expect(translationFontFamily("english")).toBe("EB Garamond");
  });
});

describe("ensureTranslationFont", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, "fonts");
  });

  it("loads the translation's font for text in its script", async () => {
    const load = vi.fn().mockResolvedValue([]);
    stubFonts(load);

    await ensureTranslationFont("urdu");

    expect(load).toHaveBeenCalledWith('1em "Jameel Noori Nastaleeq"', "اردو");
  });

  it("resolves as soon as the font is ready", async () => {
    let finish!: () => void;
    stubFonts(vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })));
    const done = vi.fn();

    ensureTranslationFont("hindi", 3000).then(done);
    await vi.advanceTimersByTimeAsync(100);
    expect(done).not.toHaveBeenCalled();

    finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toHaveBeenCalled();
  });

  it("stops waiting after the timeout so a slow font never holds the text back", async () => {
    stubFonts(vi.fn(() => new Promise(() => {})));
    const done = vi.fn();

    ensureTranslationFont("urdu", 3000).then(done);
    await vi.advanceTimersByTimeAsync(2999);
    expect(done).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(done).toHaveBeenCalled();
  });

  it("resolves when the font fails to load", async () => {
    stubFonts(vi.fn().mockRejectedValue(new Error("network")));
    await expect(ensureTranslationFont("urdu")).resolves.toBeUndefined();
  });

  it("resolves when the load call throws", async () => {
    stubFonts(vi.fn(() => { throw new SyntaxError("bad font"); }));
    await expect(ensureTranslationFont("urdu")).resolves.toBeUndefined();
  });

  it("resolves at once without the font loading API", async () => {
    await expect(ensureTranslationFont("urdu")).resolves.toBeUndefined();
  });
});
