import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChapterVerses } from "@/hooks/use-chapter-verses";
import { getChapterVerses } from "@/lib/api";
import { ensureTranslationFont } from "@/lib/translation-font";
import type { VerseDto } from "@/types/api";

vi.mock("@/lib/api", () => ({ getChapterVerses: vi.fn() }));
vi.mock("@/lib/translation-font", () => ({ ensureTranslationFont: vi.fn() }));

const mockedGet = vi.mocked(getChapterVerses);
const mockedFont = vi.mocked(ensureTranslationFont);

const VERSE: VerseDto = {
  chapterNumber: 1,
  verseNumber: 1,
  arabicText: "بِسۡمِ ٱللَّهِ",
  juzNumber: 1,
  rukuId: 1,
  hasSajdah: false,
  translations: [{ translationId: 2, segmentIndex: 0, translationText: "شروع" }],
};

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useChapterVerses", () => {
  beforeEach(() => {
    mockedGet.mockResolvedValue({ items: [VERSE], totalCount: 1 } as Awaited<ReturnType<typeof getChapterVerses>>);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps loading until the translation's font is ready, then shows the verses", async () => {
    let fontReady!: () => void;
    mockedFont.mockReturnValue(new Promise<void>((resolve) => { fontReady = resolve; }));

    const { result } = renderHook(() => useChapterVerses(1, "urdu"));
    await flush();

    expect(mockedGet).toHaveBeenCalled();
    expect(mockedFont).toHaveBeenCalledWith("urdu");
    expect(result.current.loading).toBe(true);
    expect(result.current.verses).toEqual([]);

    await act(async () => {
      fontReady();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.verses).toHaveLength(1);
  });

  it("loads the new language's font when the language changes", async () => {
    mockedFont.mockResolvedValue(undefined);

    const { rerender } = renderHook(({ lang }) => useChapterVerses(1, lang), {
      initialProps: { lang: "english" as "english" | "urdu" },
    });
    await flush();
    rerender({ lang: "urdu" });
    await flush();

    expect(mockedFont.mock.calls.map(([lang]) => lang)).toEqual(["english", "urdu"]);
  });

  it("reports a failed request without waiting for the font", async () => {
    mockedFont.mockReturnValue(new Promise(() => {}));
    mockedGet.mockRejectedValue(new Error("Failed to fetch"));

    const { result } = renderHook(() => useChapterVerses(1, "urdu"));
    await flush();

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Failed to fetch");
  });
});
