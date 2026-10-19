import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReflectionsReel from "../reflections-reel";

afterEach(cleanup);

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(min-width: 641px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

describe("ReflectionsReel", () => {
  it("is a focusable list of the cards it is given", () => {
    render(
      <ReflectionsReel>
        <li>one</li>
        <li>two</li>
      </ReflectionsReel>,
    );
    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    expect(list.getAttribute("tabindex")).toBe("0");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["one", "two"]);
  });
});
