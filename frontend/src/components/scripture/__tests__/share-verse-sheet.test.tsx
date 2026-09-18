import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ShareVerseSheet from "@/components/scripture/share-verse-sheet";
import type { RukuDto } from "@/types/api";

const ruku: RukuDto = { rukuId: 40, chapterNumber: 2, juzNumber: 3, rankInChapter: 34, rankInJuz: 1, verseCount: 5 };

function setNavigator(share: unknown, clipboard: unknown) {
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
}

function renderSheet(props: Partial<React.ComponentProps<typeof ShareVerseSheet>> = {}) {
  const onClose = vi.fn();
  render(
    <ShareVerseSheet
      isOpen
      onClose={onClose}
      chapter={2}
      verse={255}
      translation="Allah, there is no god but He."
      ruku={ruku}
      {...props}
    />,
  );
  return { onClose };
}

describe("ShareVerseSheet", () => {
  afterEach(() => {
    cleanup();
    setNavigator(undefined, undefined);
    vi.useRealTimers();
  });

  it("names the verse and offers the three places it can be opened from", () => {
    renderSheet();
    expect(screen.getByRole("dialog", { name: "Share verse" })).toBeTruthy();
    expect(screen.getByText("al-Baqarah 2:255")).toBeTruthy();
    expect(screen.getByRole("button", { name: /From its chapter/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /From its juz/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /From its ruku/ })).toBeTruthy();
  });

  it("describes where each option opens", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: /From its chapter/ }).textContent).toContain("al-Baqarah, verse 255");
    expect(screen.getByRole("button", { name: /From its juz/ }).textContent).toContain("Juz 3");
    expect(screen.getByRole("button", { name: /From its ruku/ }).textContent).toContain("Ruku 1 of juz 3");
  });

  it("keeps the juz and ruku options waiting until the verse's ruku is known", () => {
    renderSheet({ ruku: undefined });
    expect((screen.getByRole("button", { name: /From its chapter/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /From its juz/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /From its ruku/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shares the chapter link with the translation and no Arabic, then closes", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator(share, undefined);
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /From its chapter/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const payload = share.mock.calls[0][0];
    expect(payload.url).toBe(`${window.location.origin}/quran/2/?verse=255`);
    expect(payload.title).toBe("al-Baqarah 2:255");
    expect(payload.text).toContain("Allah, there is no god but He.");
    expect(payload.text).not.toMatch(/[\u0600-\u06FF]/);
  });

  it("shares the juz link in chapter-verse form", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator(share, undefined);
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /From its juz/ }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].url).toBe(`${window.location.origin}/quran/juz/3/?verse=2-255`);
  });

  it("shares the ruku link", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator(share, undefined);
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /From its ruku/ }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].url).toBe(`${window.location.origin}/quran/juz/3/ruku/1/?verse=255`);
  });

  it("confirms a clipboard copy before closing", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator(undefined, { writeText });
    const { onClose } = renderSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /From its chapter/ }));
    });
    expect(writeText).toHaveBeenCalled();
    expect(screen.getByText(/Copied/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onClose).toHaveBeenCalled();
  });

  it("stays open after a cancelled system share", async () => {
    setNavigator(vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError")), undefined);
    const { onClose } = renderSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /From its chapter/ }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const { onClose } = renderSheet();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when closed", () => {
    renderSheet({ isOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
