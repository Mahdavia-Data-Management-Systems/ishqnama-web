import type { ThemePreference } from "@/lib/theme-script";

/**
 * Reader-facing words for the app-bar appearance menu. Same rule as readiness-copy.ts and
 * sign-in-copy.ts: no technical words ("system", "theme", "mode"), enforced by
 * src/config/__tests__/theme-copy.test.ts.
 */
export const THEME_MENU_LABEL = "Appearance";

export const THEME_OPTIONS: ReadonlyArray<{
  value: ThemePreference;
  label: string;
  icon: "sun" | "moon" | "monitor";
}> = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "system", label: "Match my device", icon: "monitor" },
];
