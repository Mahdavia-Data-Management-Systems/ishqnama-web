import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWheelToHorizontal } from "@/lib/use-wheel-to-horizontal";

function Rail() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useWheelToHorizontal(el);
  return <div ref={setEl} data-testid="rail" />;
}

function setup(scrollLeft: number) {
  render(<Rail />);
  const rail = screen.getByTestId("rail");
  Object.defineProperty(rail, "scrollWidth", { value: 1000 });
  Object.defineProperty(rail, "clientWidth", { value: 400 });
  rail.scrollLeft = scrollLeft;
  return rail;
}

function wheel(rail: HTMLElement, init: WheelEventInit) {
  const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
  rail.dispatchEvent(event);
  return event;
}

// A hand-driven clock and frame queue, so the easing can be stepped frame by frame.
let now = 1000;
let frames: FrameRequestCallback[] = [];

function runFrames(count: number) {
  for (let i = 0; i < count && frames.length; i++) {
    now += 16;
    const pending = frames;
    frames = [];
    pending.forEach((cb) => cb(now));
  }
}

describe("useWheelToHorizontal", () => {
  beforeEach(() => {
    now = 1000;
    frames = [];
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      frames = [];
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("turns a vertical wheel into horizontal scroll, easing into place", () => {
    const rail = setup(0);
    const event = wheel(rail, { deltaY: 100 });
    expect(event.defaultPrevented).toBe(true);
    expect(rail.style.scrollSnapType).toBe("none");

    runFrames(1);
    const first = rail.scrollLeft;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(100);
    runFrames(1);
    expect(rail.scrollLeft - first).toBeLessThan(first);

    runFrames(200);
    expect(rail.scrollLeft).toBe(100);
    expect(frames).toHaveLength(0);
  });

  it("adds quick wheel turns into one movement", () => {
    const rail = setup(0);
    wheel(rail, { deltaY: 100 });
    runFrames(2);
    wheel(rail, { deltaY: 100 });
    runFrames(200);
    expect(rail.scrollLeft).toBe(200);
  });

  it("scales line-based wheel deltas to pixels", () => {
    const rail = setup(0);
    wheel(rail, { deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });
    runFrames(200);
    expect(rail.scrollLeft).toBe(48);
  });

  it("hands the wheel to the page once the rail is headed for its end", () => {
    const rail = setup(500);
    expect(wheel(rail, { deltaY: 100 }).defaultPrevented).toBe(true);
    runFrames(1);
    expect(rail.scrollLeft).toBeLessThan(600);
    expect(wheel(rail, { deltaY: 100 }).defaultPrevented).toBe(false);
  });

  it("restores snapping once the rail rests", () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const rail = setup(0);
    wheel(rail, { deltaY: 100 });
    runFrames(200);
    expect(rail.style.scrollSnapType).toBe("none");
    vi.advanceTimersByTime(150);
    expect(rail.style.scrollSnapType).toBe("");
    vi.useRealTimers();
  });

  it("stops easing where it is on a press", () => {
    const rail = setup(0);
    wheel(rail, { deltaY: 300 });
    runFrames(2);
    const stoppedAt = rail.scrollLeft;
    rail.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
    runFrames(200);
    expect(rail.scrollLeft).toBe(stoppedAt);
  });

  it("jumps without easing when the reader prefers reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    const rail = setup(0);
    wheel(rail, { deltaY: 100 });
    expect(rail.scrollLeft).toBe(100);
    expect(frames).toHaveLength(0);
  });

  it("hands the wheel back to the page at the end of the rail", () => {
    const rail = setup(600);
    expect(wheel(rail, { deltaY: 100 }).defaultPrevented).toBe(false);
  });

  it("hands the wheel back to the page at the start of the rail", () => {
    const rail = setup(0);
    expect(wheel(rail, { deltaY: -100 }).defaultPrevented).toBe(false);
  });

  it("leaves sideways wheels and pinch-zoom to the browser", () => {
    const rail = setup(200);
    expect(wheel(rail, { deltaX: 50, deltaY: 10 }).defaultPrevented).toBe(false);
    expect(wheel(rail, { deltaY: 100, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(wheel(rail, { deltaY: 100, shiftKey: true }).defaultPrevented).toBe(false);
    expect(rail.scrollLeft).toBe(200);
  });
});
