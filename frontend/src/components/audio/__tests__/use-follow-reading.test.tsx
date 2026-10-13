import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFollowReading } from "@/components/audio/use-follow-reading";

function Page({ current }: { current: { chapter: number; verse: number } | null }) {
  useFollowReading(current);
  return (
    <>
      <div id="verse-2-1">one</div>
      <div id="verse-2-2">two</div>
    </>
  );
}

const scrollIntoView = vi.fn();
function placeVerse(id: string, top: number) {
  const el = document.getElementById(id)!;
  el.scrollIntoView = scrollIntoView;
  el.getBoundingClientRect = () => ({ top, bottom: top + 40, left: 0, right: 0, width: 0, height: 40, x: 0, y: top, toJSON() {} });
}

beforeEach(() => {
  scrollIntoView.mockClear();
  Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
  vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("useFollowReading", () => {
  it("scrolls a verse into the centre when it is below the viewport", () => {
    const { rerender } = render(<Page current={null} />);
    placeVerse("verse-2-2", 1200);
    rerender(<Page current={{ chapter: 2, verse: 2 }} />);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("leaves a verse alone when it is already in view", () => {
    const { rerender } = render(<Page current={null} />);
    placeVerse("verse-2-1", 300);
    rerender(<Page current={{ chapter: 2, verse: 1 }} />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls without animation under reduced motion", () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("reduce"), media: q, addEventListener() {}, removeEventListener() {} }));
    const { rerender } = render(<Page current={null} />);
    placeVerse("verse-2-2", -100);
    rerender(<Page current={{ chapter: 2, verse: 2 }} />);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "auto", block: "center" });
  });

  it("does nothing for a verse that is not on this page", () => {
    const { rerender } = render(<Page current={null} />);
    act(() => rerender(<Page current={{ chapter: 3, verse: 1 }} />));
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
