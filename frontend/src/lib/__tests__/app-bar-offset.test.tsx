import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetAppBarOffset, useAppBarBottom } from "@/lib/app-bar-offset";

function mountBar(initialBottom: number) {
  const bar = document.createElement("header");
  bar.setAttribute("data-app-bar", "");
  const state = { bottom: initialBottom };
  bar.getBoundingClientRect = () => ({ bottom: state.bottom }) as DOMRect;
  document.body.appendChild(bar);
  return { state, remove: () => bar.remove() };
}

describe("useAppBarBottom", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetAppBarOffset();
    // A real frame callback runs later, not inside the requestAnimationFrame call.
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(
      (cb) => setTimeout(() => cb(0), 0) as unknown as number,
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("measures the bar on subscribe and follows scroll, clamping at zero", () => {
    const bar = mountBar(60);
    const { result } = renderHook(() => useAppBarBottom());
    expect(result.current).toBe(60);

    bar.state.bottom = 24;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe(24);

    bar.state.bottom = -140;
    act(() => {
      window.dispatchEvent(new Event("scroll"));
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe(0);
    bar.remove();
  });

  it("returns null before any measurement when inactive", () => {
    mountBar(60);
    const { result } = renderHook(() => useAppBarBottom(false));
    expect(result.current).toBeNull();
  });

  it("stops listening once the last subscriber is gone", () => {
    const bar = mountBar(60);
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useAppBarBottom());
    unmount();
    expect(remove).toHaveBeenCalledWith("scroll", expect.any(Function));
    bar.remove();
  });
});
