import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readQuranIndexView, saveQuranIndexView } from "@/lib/quran-index-view";

// Node 25's own experimental localStorage global shadows jsdom's and has no methods, so each test gets an in-memory one.
function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

describe("Quran index view storage", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to sura when nothing is saved", () => {
    expect(readQuranIndexView()).toBe("sura");
  });

  it("reads back a saved choice", () => {
    saveQuranIndexView("juz");
    expect(readQuranIndexView()).toBe("juz");
    saveQuranIndexView("sura");
    expect(readQuranIndexView()).toBe("sura");
  });

  it("ignores an unknown saved value", () => {
    localStorage.setItem("quran-index-view", "ruku");
    expect(readQuranIndexView()).toBe("sura");
  });

  it("falls back to sura and keeps working when storage is blocked", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
    expect(() => saveQuranIndexView("juz")).not.toThrow();
    expect(readQuranIndexView()).toBe("sura");
  });
});
