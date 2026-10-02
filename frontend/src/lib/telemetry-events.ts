/**
 * The reader-activity events sent to Application Insights, and the only property keys they may
 * carry. `trackEvent` in `telemetry.ts` drops any other key, so verse text, search text, names,
 * emails or tokens can never leave the app by accident. Add a name here and one `trackEvent`
 * call at its site; add a key only if it holds a choice or a count, never free text.
 */
export type TelemetryEvent =
  | "verse-shared"
  | "bookmark-created"
  | "bookmark-deleted"
  | "list-created"
  | "list-published"
  | "list-group-added"
  | "list-favorited"
  | "list-unfavorited"
  | "list-shared"
  | "sign-in-prompt-shown"
  | "sign-in-started"
  | "translation-language-changed"
  | "reading-mode-changed"
  | "theme-changed"
  | "index-view-changed"
  | "search-submitted"
  | "book-model-shown"
  | "book-model-fallback"
  | "api-unreachable";

export type TelemetryMetric = "api-warmup-ms" | `web-vital-${string}`;

export const TELEMETRY_PROPERTY_KEYS = [
  "option",
  "method",
  "feature",
  "from",
  "to",
  "mode",
  "theme",
  "view",
  "resultCount",
  "variant",
  "reason",
  "rating",
  "route",
] as const;

export type TelemetryPropertyKey = (typeof TELEMETRY_PROPERTY_KEYS)[number];

export type TelemetryProperties = Partial<Record<TelemetryPropertyKey, string | number>>;

const ALLOWED = new Set<string>(TELEMETRY_PROPERTY_KEYS);

/** Copies only the allowed keys, so an untyped caller cannot smuggle in other data. */
export function sanitizeProperties(
  props: Record<string, unknown> | undefined,
): TelemetryProperties | undefined {
  if (!props) return undefined;
  const clean: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(props)) {
    if (ALLOWED.has(key) && (typeof value === "string" || typeof value === "number")) {
      clean[key] = value;
    }
  }
  return clean as TelemetryProperties;
}
