import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDragToScroll } from "@/lib/use-drag-to-scroll";

function Rail() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useDragToScroll(el);
  return (
    <div ref={setEl} data-testid="rail">
      <a href="#card">card</a>
    </div>
  );
}

function setup(scrollLeft = 200) {
  render(<Rail />);
  const rail = screen.getByTestId("rail");
  // jsdom has no layout; give the rail room to scroll.
  Object.defineProperty(rail, "scrollWidth", { configurable: true, value: 2000 });
  Object.defineProperty(rail, "clientWidth", { configurable: true, value: 400 });
  // jsdom has no pointer capture.
  rail.setPointerCapture = () => {};
  rail.releasePointerCapture = () => {};
  rail.hasPointerCapture = () => true;
  rail.scrollLeft = scrollLeft;
  return { rail, link: screen.getByText("card") };
}

// jsdom lacks PointerEvent, so build one from a plain event.
function pointer(target: Element, type: string, clientX: number, pointerType = "mouse") {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0 });
  Object.assign(event, { pointerId: 1, pointerType });
  target.dispatchEvent(event);
}

function click(target: Element) {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

// A hand-driven clock and frame queue, so a glide can be stepped frame by frame.
function fakeTime() {
  let now = 1000;
  let frames: FrameRequestCallback[] = [];
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frames = [];
  });
  return {
    advance(ms: number) {
      now += ms;
    },
    runFrames(count: number) {
      for (let i = 0; i < count && frames.length; i++) {
        now += 16;
        const pending = frames;
        frames = [];
        pending.forEach((cb) => cb(now));
      }
    },
    get pendingFrames() {
      return frames.length;
    },
  };
}

describe("useDragToScroll", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("scrolls the rail opposite to the mouse drag", () => {
    const { rail, link } = setup();
    pointer(link, "pointerdown", 300);
    pointer(link, "pointermove", 250);
    expect(rail.scrollLeft).toBe(250);
    expect(rail.dataset.dragging).toBe("");
    pointer(link, "pointerup", 250);
    expect(rail.dataset.dragging).toBeUndefined();
  });

  it("swallows the click that ends a drag, but only that one", () => {
    const { link } = setup();
    pointer(link, "pointerdown", 300);
    pointer(link, "pointermove", 200);
    pointer(link, "pointerup", 200);
    expect(click(link).defaultPrevented).toBe(true);
    expect(click(link).defaultPrevented).toBe(false);
  });

  it("keeps a click with a small wobble as a click", () => {
    const { rail, link } = setup();
    pointer(link, "pointerdown", 300);
    pointer(link, "pointermove", 297);
    pointer(link, "pointerup", 297);
    expect(rail.scrollLeft).toBe(200);
    expect(click(link).defaultPrevented).toBe(false);
  });

  it("leaves touch to native scrolling", () => {
    const { rail, link } = setup();
    pointer(link, "pointerdown", 300, "touch");
    pointer(link, "pointermove", 200, "touch");
    expect(rail.scrollLeft).toBe(200);
  });

  it("keeps gliding after a flick and slows to a stop", () => {
    const time = fakeTime();
    const { rail, link } = setup(1000);
    pointer(link, "pointerdown", 300);
    time.advance(16);
    pointer(link, "pointermove", 280);
    time.advance(16);
    pointer(link, "pointermove", 260);
    time.advance(16);
    pointer(link, "pointerup", 260);
    const released = rail.scrollLeft;
    expect(rail.style.scrollSnapType).toBe("none");

    time.runFrames(1);
    const afterOne = rail.scrollLeft;
    expect(afterOne).toBeGreaterThan(released);
    time.runFrames(1);
    expect(rail.scrollLeft - afterOne).toBeLessThan(afterOne - released);

    time.runFrames(500);
    expect(time.pendingFrames).toBe(0);
    expect(rail.style.scrollSnapType).toBe("");
  });

  it("does not glide after the pointer came to rest before release", () => {
    const time = fakeTime();
    const { rail, link } = setup(1000);
    pointer(link, "pointerdown", 300);
    time.advance(16);
    pointer(link, "pointermove", 260);
    time.advance(200);
    pointer(link, "pointerup", 260);
    expect(time.pendingFrames).toBe(0);
    expect(rail.style.scrollSnapType).toBe("");
  });

  it("stops at the rail's end", () => {
    const time = fakeTime();
    const { rail, link } = setup(1590);
    pointer(link, "pointerdown", 300);
    time.advance(16);
    pointer(link, "pointermove", 260);
    time.advance(16);
    pointer(link, "pointermove", 220);
    pointer(link, "pointerup", 220);
    time.runFrames(50);
    expect(rail.scrollLeft).toBe(1600);
    expect(time.pendingFrames).toBe(0);
  });

  it("stops the glide on a press, and that press does not follow the link", () => {
    const time = fakeTime();
    const { rail, link } = setup(1000);
    pointer(link, "pointerdown", 300);
    time.advance(16);
    pointer(link, "pointermove", 260);
    time.advance(16);
    pointer(link, "pointermove", 220);
    pointer(link, "pointerup", 220);
    expect(click(link).defaultPrevented).toBe(true);
    time.runFrames(2);

    pointer(link, "pointerdown", 220);
    const stoppedAt = rail.scrollLeft;
    expect(time.pendingFrames).toBe(0);
    expect(rail.style.scrollSnapType).toBe("");
    pointer(link, "pointerup", 220);
    expect(click(link).defaultPrevented).toBe(true);
    expect(rail.scrollLeft).toBe(stoppedAt);
    expect(click(link).defaultPrevented).toBe(false);
  });

  it("does not glide when the reader prefers reduced motion", () => {
    const time = fakeTime();
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    const { link } = setup(1000);
    pointer(link, "pointerdown", 300);
    time.advance(16);
    pointer(link, "pointermove", 260);
    time.advance(16);
    pointer(link, "pointermove", 220);
    pointer(link, "pointerup", 220);
    expect(time.pendingFrames).toBe(0);
  });
});
