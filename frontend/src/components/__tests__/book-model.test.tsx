import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BookModel, { BOOK_POSTER_ALT } from "@/components/book-model/book-model";

// vi.mock factories are hoisted above the imports, so anything they reference must be hoisted too.
const { canRenderBook, createBookScene, fakeScene } = vi.hoisted(() => {
  const fakeScene = {
    setTilt: vi.fn(),
    setProgress: vi.fn(),
    resize: vi.fn(),
    setActive: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    fakeScene,
    canRenderBook: vi.fn<() => boolean>(),
    createBookScene: vi.fn(async (..._args: unknown[]) => fakeScene),
  };
});
vi.mock("@/lib/book-model-support", () => ({ canRenderBook }));
vi.mock("@/components/book-model/book-scene", () => ({ createBookScene }));

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;
let intersect: ObserverCallback = () => {};

class FakeIntersectionObserver {
  constructor(callback: ObserverCallback) {
    intersect = callback;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

class FakeResizeObserver {
  observe() {}
  disconnect() {}
  unobserve() {}
}

describe("BookModel", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(hover: hover)",
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    Object.defineProperty(document, "readyState", { value: "complete", configurable: true });
    createBookScene.mockClear();
    fakeScene.dispose.mockClear();
    fakeScene.setProgress.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the poster and no canvas when the browser cannot render the book", async () => {
    canRenderBook.mockReturnValue(false);
    render(<BookModel variant="hero" />);
    expect(screen.getByAltText(BOOK_POSTER_ALT)).toBeTruthy();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector("canvas")).toBeNull();
    expect(createBookScene).not.toHaveBeenCalled();
  });

  it("shows the poster only when live is false, even on a capable browser", async () => {
    canRenderBook.mockReturnValue(true);
    render(<BookModel variant="card" live={false} progress={0.4} />);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.querySelector("canvas")).toBeNull();
    expect(createBookScene).not.toHaveBeenCalled();
  });

  it("creates the scene once the box is in view and disposes it on unmount", async () => {
    canRenderBook.mockReturnValue(true);
    const { unmount } = render(<BookModel variant="hero" progress={0.25} />);
    const canvas = await waitFor(() => {
      const found = document.querySelector("canvas");
      expect(found).not.toBeNull();
      return found!;
    });
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(createBookScene).not.toHaveBeenCalled();

    await act(async () => {
      intersect([{ isIntersecting: true }]);
    });
    await waitFor(() => expect(createBookScene).toHaveBeenCalledTimes(1));
    const [, options] = createBookScene.mock.calls[0] as unknown as [
      HTMLCanvasElement,
      { variant: string; progress?: number; hoverCapable: boolean; modelUrl: string },
    ];
    expect(options.variant).toBe("hero");
    expect(options.progress).toBe(0.25);
    expect(options.hoverCapable).toBe(true);
    expect(options.modelUrl).toBe("/models/noor-e-imaan-book.v1.glb");
    // The poster is hidden once the scene is live so it cannot show through the canvas.
    await waitFor(() =>
      expect(screen.getByAltText(BOOK_POSTER_ALT).className).toMatch(/posterHidden/),
    );

    unmount();
    expect(fakeScene.dispose).toHaveBeenCalledTimes(1);
  });

  it("passes a changed progress to the live scene", async () => {
    canRenderBook.mockReturnValue(true);
    const { rerender } = render(<BookModel variant="card" progress={0.1} />);
    await waitFor(() => expect(document.querySelector("canvas")).not.toBeNull());
    await act(async () => {
      intersect([{ isIntersecting: true }]);
    });
    await waitFor(() => expect(createBookScene).toHaveBeenCalledTimes(1));

    rerender(<BookModel variant="card" progress={0.6} />);
    await waitFor(() => expect(fakeScene.setProgress).toHaveBeenCalledWith(0.6));
  });
});
