import { useSyncExternalStore } from "react";

/**
 * Light, dark or following the device, remembered per browser. Light until the reader chooses.
 *
 * themeScript() runs inline in the document head before first paint and sets data-theme,
 * color-scheme and the theme-color meta on <html>, so the prerendered page never flashes the
 * wrong colours. The store below takes over after hydration: it keeps the page in step with
 * the device while the preference is "system", follows choices made in other tabs, and backs
 * useTheme() for the app-bar menu. The two apply the same three changes; the "agrees with the
 * head script" test keeps them in step.
 */
import {
  DARK_QUERY,
  DEFAULT_THEME_PREFERENCE,
  THEME_COLOR,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "./theme-script";

export { THEME_COLOR, THEME_STORAGE_KEY, themeScript } from "./theme-script";
export type { ResolvedTheme, ThemePreference } from "./theme-script";

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

function deviceQuery(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DARK_QUERY)
    : null;
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return deviceQuery()?.matches ? "dark" : "light";
}

function apply(theme: ResolvedTheme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.style.colorScheme = theme;
  // Every one, not the first: Next.js adds a second theme-color meta at hydration.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", THEME_COLOR[theme]);
  }
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}

const SERVER_STATE: ThemeState = { preference: DEFAULT_THEME_PREFERENCE, resolved: "light" };

let state: ThemeState | null = null;
// A choice made while storage is blocked lives here for the rest of the visit.
let sessionPreference: ThemePreference | null = null;
const listeners = new Set<() => void>();
let detach: (() => void) | null = null;

function compute(): ThemeState {
  const preference = sessionPreference ?? readPreference();
  return { preference, resolved: resolve(preference) };
}

/** Re-reads storage and the device, applies the result and notifies subscribers of a change. */
function refresh(): void {
  const next = compute();
  apply(next.resolved);
  if (state && state.preference === next.preference && state.resolved === next.resolved) return;
  state = next;
  for (const listener of listeners) listener();
}

function attach(): () => void {
  const query = deviceQuery();
  const onDevice = () => refresh();
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_STORAGE_KEY && e.key !== null) return;
    sessionPreference = null;
    refresh();
  };
  query?.addEventListener?.("change", onDevice);
  window.addEventListener("storage", onStorage);

  // Next.js re-renders its viewport theme-color meta on client navigation, resetting it to the
  // light colour. Put back the current theme's colour whenever that happens. Setting a value that
  // already matches is skipped, so the observer's own writes do not loop.
  const heads = typeof MutationObserver === "function" ? new MutationObserver(() => {
    const want = THEME_COLOR[getSnapshot().resolved];
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      if (meta.getAttribute("content") !== want) meta.setAttribute("content", want);
    }
  }) : null;
  heads?.observe(document.head, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] });

  return () => {
    query?.removeEventListener?.("change", onDevice);
    window.removeEventListener("storage", onStorage);
    heads?.disconnect();
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!detach) {
    detach = attach();
    // Re-apply once after hydration: if Next.js placed the theme-color meta after the head
    // script, the script could not update it.
    apply(getSnapshot().resolved);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && detach) {
      detach();
      detach = null;
    }
  };
}

// Called during render, so it never notifies: it only fills the first snapshot. The head script
// has already applied the same theme to the page.
function getSnapshot(): ThemeState {
  if (!state) state = compute();
  return state;
}

/** Remembers the choice in this browser (or for this visit when storage is blocked) and applies it. */
export function setThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
    sessionPreference = null;
  } catch {
    sessionPreference = preference;
  }
  refresh();
}

export function useTheme(): ThemeState & { setPreference: (p: ThemePreference) => void } {
  const current = useSyncExternalStore(subscribe, getSnapshot, () => SERVER_STATE);
  return { ...current, setPreference: setThemePreference };
}

/** Test-only: forget cached state and listeners so each test starts from storage. */
export function resetThemeStoreForTests(): void {
  detach?.();
  detach = null;
  listeners.clear();
  state = null;
  sessionPreference = null;
}
