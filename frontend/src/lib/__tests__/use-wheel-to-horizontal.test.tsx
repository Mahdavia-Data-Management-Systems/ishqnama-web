import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

describe("useWheelToHorizontal", () => {
  afterEach(cleanup);

  it("turns a vertical wheel into horizontal scroll", () => {
    const rail = setup(0);
    const event = wheel(rail, { deltaY: 100 });
    expect(event.defaultPrevented).toBe(true);
    expect(rail.scrollLeft).toBe(100);
  });

  it("scales line-based wheel deltas to pixels", () => {
    const rail = setup(0);
    wheel(rail, { deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(rail.scrollLeft).toBe(48);
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
