import { useSyncExternalStore } from "react";

/**
 * Light, dark or following the device, remembered per browser.
 *
 * themeScript() runs inline in the document head before first paint and sets data-theme,
 * color-scheme and the theme-color meta on <html>, so the prerendered page never flashes the
 * wrong colours. The store below takes over after hydration: it keeps the page in step with
 * the device while the preference is "system", follows choices made in other tabs, and backs
 * useTheme() for the app-bar menu. The two apply the same three changes; the "agrees with the
 * head script" test keeps them in step.
 */
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "ishqnama-theme";

/** The browser bar colour for each theme: the app bar's chrome colour. */
export const THEME_COLOR = { light: "#004446", dark: "#00292B" } as const;

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Inline script for the document head. It must stay self-contained ES5: it runs before any bundle. */
export function themeScript(): string {
  return `(function(){
var p="system";
try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(s==="light"||s==="dark"||s==="system")p=s;}catch(e){}
var d=p==="dark"||(p==="system"&&typeof window.matchMedia==="function"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);
var t=d?"dark":"light";
var h=document.documentElement;
h.setAttribute("data-theme",t);
h.style.colorScheme=t;
var m=document.querySelector('meta[name="theme-color"]');
if(m)m.setAttribute("content",d?${JSON.stringify(THEME_COLOR.dark)}:${JSON.stringify(THEME_COLOR.light)});
})();`;
}

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
  } catch {
    return "system";
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
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
}

const SERVER_STATE: ThemeState = { preference: "system", resolved: "light" };

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
  return () => {
    query?.removeEventListener?.("change", onDevice);
    window.removeEventListener("storage", onStorage);
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
