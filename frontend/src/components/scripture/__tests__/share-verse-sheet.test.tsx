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

  it("names the verse and offers the two places it can be opened from", () => {
    renderSheet();
    expect(screen.getByRole("dialog", { name: "Share" })).toBeTruthy();
    expect(screen.getByText("al-Baqarah 2:255")).toBeTruthy();
    expect(screen.getByRole("button", { name: /This ayah/ })).toBeTruthy();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /This ruku/ })).toBeTruthy();
  });

  it("describes where each option opens", () => {
    renderSheet();
    expect(screen.getByRole("button", { name: /This ayah/ }).textContent).toContain("al-Baqarah, verse 255");
    expect(screen.getByRole("button", { name: /This ruku/ }).textContent).toContain("Ruku 1 of juz 3");
  });

  it("keeps the ruku option waiting until the verse's ruku is known", () => {
    renderSheet({ ruku: undefined });
    expect((screen.getByRole("button", { name: /This ayah/ }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: /This ruku/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shares the chapter link with the translation and no Arabic, then closes", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator(share, undefined);
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /This ayah/ }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const payload = share.mock.calls[0][0];
    expect(payload.url).toBe(`${window.location.origin}/quran/2/?verse=255`);
    expect(payload.title).toBe("al-Baqarah 2:255");
    expect(payload.text.startsWith("Noor-e-Imaan | al-Baqarah 2:255\n")).toBe(true);
    expect(payload.text).toContain("Allah, there is no god but He.");
    expect(payload.text).not.toMatch(/[\u0600-\u06FF]/);
    expect(payload.text).not.toContain(payload.url);
  });

  it("shares the ruku link", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator(share, undefined);
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: /This ruku/ }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(share.mock.calls[0][0].url).toBe(`${window.location.origin}/quran/juz/3/ruku/1/`);
    expect(share.mock.calls[0][0].text.startsWith("Noor-e-Imaan | al-Baqarah 2:255 | Juz 3, Ruku 1\n")).toBe(true);
  });

  it("confirms a clipboard copy before closing", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    setNavigator(undefined, { writeText });
    const { onClose } = renderSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /This ayah/ }));
    });
    expect(writeText).toHaveBeenCalledTimes(1);
    const copied: string = writeText.mock.calls[0][0];
    expect(copied.split(`${window.location.origin}/quran/2/?verse=255`).length - 1).toBe(1);
    expect(screen.getByText(/Copied/)).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onClose).toHaveBeenCalled();
  });

  it("stays open after a cancelled system share", async () => {
    setNavigator(vi.fn().mockRejectedValue(new DOMException("cancel", "AbortError")), undefined);
    const { onClose } = renderSheet();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /This ayah/ }));
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
