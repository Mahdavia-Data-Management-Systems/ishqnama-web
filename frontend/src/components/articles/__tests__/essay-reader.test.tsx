import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import EssayReader from "@/components/articles/essay-reader";

vi.mock("@/context/reader-settings-context", () => ({
  useReaderSettings: () => ({ fontScale: 1, openSettings: vi.fn() }),
}));
vi.mock("@/context/sign-in-prompt-context", () => ({
  useSignInGate: () => (action: () => void) => action(),
}));

// next.config sets trailingSlash; Link reads this flag when it loads, so set it first.
vi.hoisted(() => {
  process.env.__NEXT_TRAILING_SLASH = "true";
});

const previous = { href: "/articles/nooreimaan/naskh/", name: "Naskh (abrogation)" };
const following = { href: "/articles/nooreimaan/harf-e-zaid/", name: "Harf-e-zaid" };

function renderReader(children: ReactNode = <p>essay</p>, prev: typeof previous | null = previous, next = following) {
  return render(<EssayReader prev={prev} next={next}>{children}</EssayReader>);
}

function scaleOf(el: HTMLElement) {
  return el.parentElement?.style.getPropertyValue("--essay-scale");
}

describe("EssayReader", () => {
  afterEach(cleanup);

  it("gives the toolbar the neighbouring essays, the font stepper and settings, but no mode or language", () => {
    renderReader();
    expect(screen.getByRole("link", { name: "Previous: Naskh (abrogation)" }).getAttribute("href")).toBe(previous.href);
    expect(screen.getByRole("link", { name: "Next: Harf-e-zaid" }).getAttribute("href")).toBe(following.href);
    expect(screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      "Decrease font size",
      "Increase font size",
      "Settings",
    ]);
    expect(screen.getByText("T 100%")).toBeTruthy();
  });

  it("reads right to left, as the footer does: next on the left, previous on the right", () => {
    renderReader();
    const links = screen.getAllByRole("link").map((l) => l.getAttribute("aria-label"));
    expect(links).toEqual(["Next: Harf-e-zaid", "Previous: Naskh (abrogation)"]);
  });

  it("leaves out the arrow with no essay on that side", () => {
    renderReader(<p>essay</p>, null);
    expect(screen.queryByRole("link", { name: /^Previous/ })).toBeNull();
    expect(screen.getByRole("link", { name: /^Next/ })).toBeTruthy();
  });

  it("starts at the saved size and scales the essay as the reader steps it", () => {
    renderReader();
    expect(scaleOf(screen.getByText("essay"))).toBe("1");
    fireEvent.click(screen.getByRole("button", { name: "Increase font size" }));
    expect(screen.getByText("T 115%")).toBeTruthy();
    expect(scaleOf(screen.getByText("essay"))).toBe("1.15");
  });
});
