import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import QuranIndex from "@/components/scripture/quran-index";

vi.mock("@/context/reader-settings-context", () => ({
  useReaderSettings: () => ({ lang: "urdu", showSuraRukuMarks: false, showJuzRukuMarks: false }),
}));
vi.mock("@/lib/api-client", () => ({ apiFetchWithOptionalAuth: vi.fn(() => Promise.resolve([])) }));
vi.mock("@/lib/app-bar-offset", () => ({ useAppBarBottom: () => null }));

// Node 25's own experimental localStorage global shadows jsdom's and has no methods, so each test gets an in-memory one.
function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

const heading = () => screen.getByRole("heading", { level: 2 }).textContent;

describe("QuranIndex Sura/Juz choice", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows the chapters when nothing is saved", () => {
    render(<QuranIndex />);
    expect(heading()).toBe("All chapters");
  });

  it("opens on the juz list when that was the saved choice", () => {
    localStorage.setItem("quran-index-view", "juz");
    render(<QuranIndex />);
    expect(heading()).toBe("All Ajza");
  });

  it("remembers the choice for the next visit", () => {
    render(<QuranIndex />);
    fireEvent.click(screen.getByRole("tab", { name: "JUZ" }));
    expect(localStorage.getItem("quran-index-view")).toBe("juz");
    cleanup();
    render(<QuranIndex />);
    expect(heading()).toBe("All Ajza");
  });
});
