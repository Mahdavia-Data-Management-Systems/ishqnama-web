import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

describe("useDragToScroll", () => {
  afterEach(cleanup);

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
});
