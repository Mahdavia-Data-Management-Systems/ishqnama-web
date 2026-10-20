import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EssayScrollTop from "@/components/articles/essay-scroll-top";

describe("EssayScrollTop", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("scrolls the page to its top, instantly, when the essay mounts", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    render(<EssayScrollTop />);

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });
});
