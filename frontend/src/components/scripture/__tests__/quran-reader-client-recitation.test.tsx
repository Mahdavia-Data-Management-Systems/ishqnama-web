import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DisplayVerse } from "@/hooks/use-chapter-verses";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/quran/juz/1/",
}));
vi.mock("@/context/reader-settings-context", () => ({
  useReaderSettings: () => ({ mode: "verse", fontScale: 2, showTafseer: false, lang: "english", openSettings: vi.fn() }),
}));
vi.mock("@/context/bookmarks-context", () => ({
  useBookmarks: () => ({ bookmarks: [], savePosition: vi.fn(), addBookmark: vi.fn() }),
}));
vi.mock("@/context/sign-in-prompt-context", () => ({ useSignInGate: () => (fn: () => void) => fn() }));
vi.mock("@/lib/api-readiness", () => ({ useApiReadiness: () => "ready" }));
vi.mock("@/components/bookmark-picker", () => ({ default: () => null }));
vi.mock("@/components/create-bookmark-dialog", () => ({ default: () => null }));
vi.mock("@/components/reader-toolbar", () => ({ default: () => null }));
vi.mock("@/components/ui/back-to-top", () => ({ default: () => null }));

const play = vi.fn();
let reading: { chapter: number; verse: number } | null = null;
vi.mock("@/context/audio-player-context", () => ({
  useAudioPlayer: () => ({
    status: reading ? "playing" : "closed",
    current: reading ? { ref: reading } : null,
    play,
    isCurrent: (ref: { chapter: number; verse: number }) =>
      reading != null && reading.chapter === ref.chapter && reading.verse === ref.verse,
  }),
}));

import QuranReaderClient from "@/components/scripture/quran-reader-client";

const verses: DisplayVerse[] = [
  { chapterNumber: 1, number: 7, arabic: "صِرَاطَ", rukuId: 1, hasSajdah: false },
  { chapterNumber: 2, number: 0, arabic: "بِسْمِ", rukuId: 2, hasSajdah: false },
  { chapterNumber: 2, number: 1, arabic: "الٓمٓ", rukuId: 2, hasSajdah: false },
];

function renderReader() {
  return render(
    <QuranReaderClient verses={verses} loading={false} error={null} retry={() => {}} lang="english" onLangChange={() => {}} prev={null} next={null} />,
  );
}

afterEach(() => { cleanup(); play.mockClear(); reading = null; });

describe("QuranReaderClient recitation", () => {
  it("plays the page's verses from the tapped one, basmala included", () => {
    renderReader();
    const buttons = screen.getAllByRole("button", { name: "Play recitation" });
    expect(buttons).toHaveLength(2);           // verse 0 is a BismillahBlock, without actions
    fireEvent.click(buttons[1]);                // 2:1
    expect(play).toHaveBeenCalledTimes(1);
    const [playlist, index, trigger] = play.mock.calls[0];
    expect(playlist.id).toBe("/quran/juz/1/");
    expect(playlist.href).toBe("/quran/juz/1/");
    expect(playlist.clips.map((c: { ref: unknown }) => c.ref)).toEqual([
      { chapter: 1, verse: 7 }, { chapter: 2, verse: 0 }, { chapter: 2, verse: 1 },
    ]);
    expect(index).toBe(2);
    expect(trigger).toBe(buttons[1]);
  });

  it("washes the verse being read", () => {
    reading = { chapter: 2, verse: 1 };
    renderReader();
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(document.getElementById("verse-2-1")?.className).toMatch(/reading/);
  });
});
