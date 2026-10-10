import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EssayStickyBar from "@/components/articles/essay-sticky-bar";

vi.mock("@/lib/app-bar-offset", () => ({ useAppBarBottom: () => 60 }));

/** Places an element's bottom edge at `bottom` viewport pixels. */
function placeBottom(el: Element, bottom: number) {
  el.getBoundingClientRect = () => ({ bottom }) as DOMRect;
}

function renderBar(titleBottom: number) {
  const heading = document.createElement("h1");
  heading.id = "essay-title";
  placeBottom(heading, titleBottom);
  document.body.appendChild(heading);
  const result = render(
    <EssayStickyBar title="نسخ" titleId="essay-title" start={<a href="/articles/">Articles</a>} end={<button>Share</button>} />,
  );
  placeBottom(result.container.firstElementChild!, 112);
  return heading;
}

describe("EssayStickyBar", () => {
  afterEach(() => {
    cleanup();
    document.getElementById("essay-title")?.remove();
  });

  it("pins under the app bar and keeps the small title hidden while the page title is in view", async () => {
    renderBar(300);
    await act(() => new Promise(requestAnimationFrame));
    const small = screen.getByText("نسخ");
    expect((small.parentElement as HTMLElement).style.top).toBe("60px");
    expect(small.getAttribute("aria-hidden")).toBe("true");
    expect(small.dataset.shown).toBeUndefined();
  });

  it("shows the small title once the page title has scrolled under the row, and hides it again on the way back", async () => {
    const heading = renderBar(300);
    placeBottom(heading, 100);
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise(requestAnimationFrame);
    });
    expect(screen.getByText("نسخ").dataset.shown).toBe("true");

    placeBottom(heading, 300);
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise(requestAnimationFrame);
    });
    expect(screen.getByText("نسخ").dataset.shown).toBeUndefined();
  });
});
