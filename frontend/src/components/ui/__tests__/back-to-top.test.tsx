import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BackToTop from "@/components/ui/back-to-top";

let pathname = "/articles/nooreimaan/naskh/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

async function scrollTo(y: number) {
  await act(async () => {
    window.scrollY = y;
    window.dispatchEvent(new Event("scroll"));
    await new Promise(requestAnimationFrame);
  });
}

// Hidden, it is aria-hidden, so find it by its label without the accessibility filter.
const button = () => screen.getByLabelText("Back to top");

describe("BackToTop", () => {
  beforeEach(() => {
    window.innerHeight = 800;
    window.scrollY = 0;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });
  afterEach(() => {
    cleanup();
    pathname = "/articles/nooreimaan/naskh/";
  });

  it("stays hidden and out of the tab order until the page has scrolled a screen down", async () => {
    render(<BackToTop />);
    await scrollTo(800);
    expect(button().getAttribute("aria-hidden")).toBe("true");
    expect(button().tabIndex).toBe(-1);

    await scrollTo(801);
    expect(button().getAttribute("aria-hidden")).toBeNull();
    expect(screen.getByRole("button", { name: "Back to top" })).toBeTruthy();

    await scrollTo(100);
    expect(button().getAttribute("aria-hidden")).toBe("true");
  });

  it("scrolls the page back to the top", async () => {
    render(<BackToTop />);
    await scrollTo(2000);
    fireEvent.click(screen.getByRole("button", { name: "Back to top" }));
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("takes a different distance when asked", async () => {
    render(<BackToTop afterViewports={2} />);
    await scrollTo(1200);
    expect(button().getAttribute("aria-hidden")).toBe("true");
    await scrollTo(1700);
    expect(button().getAttribute("aria-hidden")).toBeNull();
  });

  it("sits above the reader toolbar on reader pages and above the bottom nav elsewhere", () => {
    const { unmount } = render(<BackToTop />);
    expect(button().dataset.clears).toBe("toolbar");
    unmount();
    pathname = "/about/";
    render(<BackToTop />);
    expect(button().dataset.clears).toBe("bottom-nav");
  });
});
