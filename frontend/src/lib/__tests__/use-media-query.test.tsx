import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaQuery } from "@/lib/use-media-query";

function Probe({ query }: { query: string }) {
  const matches = useMediaQuery(query);
  return <span>{matches ? "wide" : "narrow"}</span>;
}

describe("useMediaQuery", () => {
  let listeners: Array<() => void> = [];
  let matches = false;

  beforeEach(() => {
    listeners = [];
    matches = false;
    vi.stubGlobal("matchMedia", (query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      addEventListener: (_: string, listener: () => void) => listeners.push(listener),
      removeEventListener: (_: string, listener: () => void) => {
        listeners = listeners.filter((l) => l !== listener);
      },
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("reports the current match", () => {
    matches = true;
    render(<Probe query="(min-width: 640px)" />);
    expect(screen.getByText("wide")).toBeTruthy();
  });

  it("updates when the query changes and unsubscribes on unmount", () => {
    const { unmount } = render(<Probe query="(min-width: 640px)" />);
    expect(screen.getByText("narrow")).toBeTruthy();
    act(() => {
      matches = true;
      listeners.forEach((listener) => listener());
    });
    expect(screen.getByText("wide")).toBeTruthy();
    unmount();
    expect(listeners).toHaveLength(0);
  });
});
