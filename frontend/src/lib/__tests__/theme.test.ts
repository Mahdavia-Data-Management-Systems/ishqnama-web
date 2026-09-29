import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetThemeStoreForTests,
  setThemePreference,
  THEME_STORAGE_KEY,
  themeScript,
  useTheme,
} from "@/lib/theme";

// Node 25's own experimental localStorage global shadows jsdom's and has no methods, so each test gets an in-memory one.
function memoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const items = new Map<string, string>();
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, String(value)),
  };
}

/** A controllable prefers-color-scheme query. */
function fakeDevice(dark: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  const mql = {
    matches: dark,
    addEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.add(l),
    removeEventListener: (_: string, l: (e: { matches: boolean }) => void) => listeners.delete(l),
  };
  vi.stubGlobal("matchMedia", vi.fn(() => mql));
  return {
    set(next: boolean) {
      mql.matches = next;
      for (const l of listeners) l({ matches: next });
    },
  };
}

const html = () => document.documentElement;
const metaColour = () => document.querySelector('meta[name="theme-color"]')?.getAttribute("content");
const runScript = () => new Function(themeScript())();

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  document.head.innerHTML = '<meta name="theme-color" content="#004446">';
  html().removeAttribute("data-theme");
  html().style.colorScheme = "";
  resetThemeStoreForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("head script", () => {
  it.each([
    ["light", false, "light"],
    ["light", true, "light"],
    ["dark", false, "dark"],
    ["dark", true, "dark"],
    ["system", false, "light"],
    ["system", true, "dark"],
    [null, true, "light"],
    ["sepia", false, "light"],
  ])("stored %s on a %s-dark device gives %s", (stored, deviceDark, expected) => {
    fakeDevice(deviceDark);
    if (stored !== null) localStorage.setItem(THEME_STORAGE_KEY, stored);
    runScript();
    expect(html().getAttribute("data-theme")).toBe(expected);
    expect(html().style.colorScheme).toBe(expected);
    expect(metaColour()).toBe(expected === "dark" ? "#00292B" : "#004446");
  });

  it("treats blocked storage as light", () => {
    fakeDevice(true);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    runScript();
    expect(html().getAttribute("data-theme")).toBe("light");
  });

  it("treats a browser without matchMedia as a light device", () => {
    vi.stubGlobal("matchMedia", undefined);
    runScript();
    expect(html().getAttribute("data-theme")).toBe("light");
  });

  it("does not throw when the theme-color meta is missing", () => {
    fakeDevice(false);
    document.head.innerHTML = "";
    expect(runScript).not.toThrow();
  });
});

describe("theme store", () => {
  it("reads the stored preference and resolves it", () => {
    fakeDevice(false);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("dark");
    expect(result.current.resolved).toBe("dark");
  });

  it("defaults to light, even on a dark device", () => {
    fakeDevice(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.preference).toBe("light");
    expect(result.current.resolved).toBe("light");
  });

  it("persists a choice and applies it to the page", () => {
    fakeDevice(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(result.current.resolved).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
    expect(html().style.colorScheme).toBe("dark");
    expect(metaColour()).toBe("#00292B");
  });

  it("still switches for this visit when storage is blocked", () => {
    fakeDevice(false);
    vi.stubGlobal("localStorage", {
      getItem: () => null,
      setItem: () => { throw new Error("blocked"); },
    });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("dark"));
    expect(result.current.resolved).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("follows the device while on match my device", () => {
    const device = fakeDevice(false);
    localStorage.setItem(THEME_STORAGE_KEY, "system");
    const { result } = renderHook(() => useTheme());
    act(() => device.set(true));
    expect(result.current.resolved).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("ignores the device after an explicit choice", () => {
    const device = fakeDevice(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setPreference("light"));
    act(() => device.set(true));
    expect(result.current.resolved).toBe("light");
    expect(html().getAttribute("data-theme")).toBe("light");
  });

  it("follows a choice made in another tab", () => {
    fakeDevice(false);
    const { result } = renderHook(() => useTheme());
    act(() => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY }));
    });
    expect(result.current.preference).toBe("dark");
    expect(html().getAttribute("data-theme")).toBe("dark");
  });

  it("updates every theme-color meta, including one Next.js adds at hydration", () => {
    fakeDevice(false);
    document.head.insertAdjacentHTML("beforeend", '<meta name="theme-color" content="#004446">');
    runScript();
    setThemePreference("dark");
    const all = [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute("content"));
    expect(all).toEqual(["#00292B", "#00292B"]);
  });

  it("corrects a theme-color meta that Next.js re-renders on client navigation", async () => {
    fakeDevice(false);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    renderHook(() => useTheme());
    document.head.insertAdjacentHTML("beforeend", '<meta name="theme-color" content="#004446">');
    const added = document.head.lastElementChild!;
    await new Promise((r) => setTimeout(r, 0));
    expect(added.getAttribute("content")).toBe("#00292B");
    added.setAttribute("content", "#004446");
    await new Promise((r) => setTimeout(r, 0));
    expect(added.getAttribute("content")).toBe("#00292B");
  });

  it("head script updates every theme-color meta", () => {
    fakeDevice(false);
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    document.head.insertAdjacentHTML("beforeend", '<meta name="theme-color" content="#004446">');
    runScript();
    const all = [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.getAttribute("content"));
    expect(all).toEqual(["#00292B", "#00292B"]);
  });

  it("agrees with the head script for every preference", () => {
    for (const deviceDark of [false, true]) {
      for (const p of ["light", "dark", "system"] as const) {
        fakeDevice(deviceDark);
        localStorage.setItem(THEME_STORAGE_KEY, p);
        runScript();
        const fromScript = [html().getAttribute("data-theme"), html().style.colorScheme, metaColour()];
        html().removeAttribute("data-theme");
        resetThemeStoreForTests();
        setThemePreference(p);
        expect([html().getAttribute("data-theme"), html().style.colorScheme, metaColour()]).toEqual(fromScript);
      }
    }
  });
});
