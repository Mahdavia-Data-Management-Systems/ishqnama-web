import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContinueReadingCard from "@/components/continue-reading-card";
import { BOOK_POSTER_ALT } from "@/components/book-model/book-model";

vi.mock("@/lib/book-model-support", () => ({ canRenderBook: () => false }));

const baseProps = {
  suraNumber: 2,
  suraName: "al-Baqarah",
  arabicName: "البقرة",
  verseNumber: 143,
  totalVerses: 286,
};

describe("ContinueReadingCard", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the verse progress bar at 50% without a book", () => {
    const { container } = render(<ContinueReadingCard {...baseProps} />);
    expect(screen.getByText("Verse 143 of 286")).toBeTruthy();
    const fill = container.querySelector("[data-progress-fill]") as HTMLElement;
    expect(fill.style.width).toBe("50%");
    expect(screen.queryByAltText(BOOK_POSTER_ALT)).toBeNull();
  });

  it("keeps the progress bar and adds the book when progress is given", () => {
    const { container } = render(<ContinueReadingCard {...baseProps} progress={0.04} />);
    const fill = container.querySelector("[data-progress-fill]") as HTMLElement;
    expect(fill.style.width).toBe("50%");
    expect(screen.getByAltText(BOOK_POSTER_ALT)).toBeTruthy();
  });

  it("links to the verse", () => {
    render(<ContinueReadingCard {...baseProps} />);
    // next/link only re-adds the trailing slash when next.config's trailingSlash is loaded,
    // which vitest does not do, so accept the path with or without it.
    expect(screen.getByRole("link").getAttribute("href")).toMatch(/^\/quran\/2\/?\?verse=143$/);
  });
});
