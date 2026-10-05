import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AddToListSheet from "@/components/lists/add-to-list-sheet";
import { LISTS_COPY } from "@/config/lists-copy";
import { clearArabicVersesCache } from "@/hooks/use-arabic-verses";
import { getChapterArabic } from "@/lib/lists-api";
import type { ArabicVerseDto } from "@/types/lists";

const lists = vi.hoisted(() => ({ addGroup: vi.fn() }));

vi.mock("@/context/lists-context", () => ({
  useLists: () => ({
    myLists: [{ id: "list00000001", title: "Verses to memorise", status: "draft" }],
    status: "ready",
    createList: vi.fn(),
    addGroup: lists.addGroup,
  }),
}));
vi.mock("@/context/reader-settings-context", () => ({
  useReaderSettings: () => ({ lang: "english", fontScale: 2 }),
}));
vi.mock("@/lib/lists-api", () => ({ getChapterArabic: vi.fn() }));
vi.mock("@/components/lists/create-list-dialog", () => ({ default: () => null }));

function verses(from: number, to: number): ArabicVerseDto[] {
  return Array.from({ length: to - from + 1 }, (_, i) => ({
    verseNumber: from + i,
    arabicText: `آية ${from + i}`,
    hasSajdah: false,
  }));
}

describe("AddToListSheet", () => {
  beforeEach(() => {
    clearArabicVersesCache();
    lists.addGroup.mockReset().mockResolvedValue(undefined);
    vi.mocked(getChapterArabic).mockImplementation((_c, from, to) => Promise.resolve(verses(from, to)));
  });
  afterEach(cleanup);

  it("starts the slider at the tapped ayah and runs it to the end of the sura", async () => {
    render(<AddToListSheet chapter={112} verse={2} onClose={() => {}} />);
    const slider = screen.getByRole("slider", { name: LISTS_COPY.toLabel }) as HTMLInputElement;
    expect(slider.value).toBe("2");
    expect(slider.min).toBe("2");
    expect(slider.max).toBe("4");
    expect(await screen.findByText("آية 2")).toBeTruthy();
    expect(screen.queryByText("آية 4")).toBeNull();
    expect(screen.getByText(LISTS_COPY.stretchHint)).toBeTruthy();
    expect(getChapterArabic).toHaveBeenCalledWith(112, 2, 4);
  });

  it("previews the first and last ayah as the slider moves, and adds that range", async () => {
    render(<AddToListSheet chapter={112} verse={2} onClose={() => {}} />);
    await screen.findByText("آية 2");
    fireEvent.change(screen.getByRole("slider"), { target: { value: "4" } });

    expect(screen.getByText("آية 2")).toBeTruthy();
    expect(screen.getByText("آية 4")).toBeTruthy();
    expect(screen.queryByText("آية 3")).toBeNull();
    expect(screen.queryByText(LISTS_COPY.stretchHint)).toBeNull();
    expect(screen.getByText(/112:2–4/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: LISTS_COPY.addToList }));
    await waitFor(() =>
      expect(lists.addGroup).toHaveBeenCalledWith("list00000001", {
        chapter: 112,
        fromVerse: 2,
        toVerse: 4,
        caption: null,
      }),
    );
  });

  it("steps the slider one ayah at a time, stopping at either end", async () => {
    render(<AddToListSheet chapter={112} verse={2} onClose={() => {}} />);
    await screen.findByText("آية 2");
    const slider = screen.getByRole("slider") as HTMLInputElement;
    const down = screen.getByRole("button", { name: LISTS_COPY.stepDown }) as HTMLButtonElement;
    const up = screen.getByRole("button", { name: LISTS_COPY.stepUp }) as HTMLButtonElement;
    expect(down.disabled).toBe(true);

    fireEvent.click(up);
    expect(slider.value).toBe("3");
    expect(screen.getByText("آية 3")).toBeTruthy();
    fireEvent.click(up);
    expect(slider.value).toBe("4");
    expect(up.disabled).toBe(true);

    fireEvent.click(down);
    expect(slider.value).toBe("3");
    expect(down.disabled).toBe(false);
  });

  it("leaves the slider out on the last ayah of a sura", async () => {
    render(<AddToListSheet chapter={112} verse={4} onClose={() => {}} />);
    expect(await screen.findByText("آية 4")).toBeTruthy();
    expect(screen.queryByRole("slider")).toBeNull();
    expect(screen.queryByText(LISTS_COPY.stretchHint)).toBeNull();
  });
});
