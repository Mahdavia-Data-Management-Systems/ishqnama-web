import type { ApplicationInsights, ITelemetryItem } from "@microsoft/applicationinsights-web";
import {
  sanitizeProperties,
  type TelemetryEvent,
  type TelemetryMetric,
  type TelemetryProperties,
} from "@/lib/telemetry-events";

/**
 * Application Insights for the browser, behind a facade the rest of the app imports.
 *
 * The SDK (~45 KB gzipped) is never imported statically: `initTelemetry()` waits for the window
 * `load` event and an idle moment, then imports it as its own chunk, so it never competes with
 * first paint. Calls made before that are buffered (oldest dropped past `BUFFER_LIMIT`) and
 * replayed in order. Without `NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING` (local dev, tests)
 * every call is a no-op.
 *
 * Correlation: the SDK's own header injection is off, because a `traceparent` header on an
 * anonymous GET would turn that CORS "simple" request into a preflighted one. `api-client.ts`
 * adds `traceparentHeader()` only to requests that already carry `Authorization`. See
 * plans/app-insights-observability-spec.md, Decision 3.
 */

export const BUFFER_LIMIT = 50;

type Call = (ai: ApplicationInsights) => void;
type SdkLoader = () => Promise<ApplicationInsights>;

let sdk: ApplicationInsights | null = null;
let buffer: Call[] = [];
let initStarted: Promise<void> | null = null;

function connectionString(): string {
  return process.env.NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING ?? "";
}

export function isTelemetryEnabled(): boolean {
  return connectionString() !== "";
}

function run(call: Call): void {
  if (!isTelemetryEnabled()) return;
  if (sdk) {
    call(sdk);
    return;
  }
  buffer.push(call);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();
}

function randomHex(length: number): string {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Removes the fragment, which can hold an auth response, from a telemetry URL. */
function stripHash(url: unknown): unknown {
  return typeof url === "string" ? url.split("#")[0] : url;
}

function scrub(item: ITelemetryItem): boolean {
  const data = item.baseData as Record<string, unknown> | undefined;
  if (!data) return true;
  for (const key of ["uri", "refUri", "url"]) {
    if (key in data) data[key] = stripHash(data[key]);
  }
  // The redirect bridge never mounts telemetry; this is a safety net.
  return !String(data.uri ?? "").includes("/redirect/");
}

/**
 * Whether a tracked fetch is a call to the API. Everything else is dropped: Next.js prefetches
 * every visible link's `?_rsc=` payload (hundreds on the Quran index), and MSAL's token calls
 * carry nothing worth keeping, so recording them would use up the daily cap on noise.
 */
export function isApiCall(url: string | undefined): boolean {
  const api = process.env.NEXT_PUBLIC_API_URL;
  if (!api || !url) return false;
  try {
    return new URL(url, window.location.href).origin === new URL(api).origin;
  } catch {
    return false;
  }
}

async function loadSdk(): Promise<ApplicationInsights> {
  const { ApplicationInsights, DistributedTracingModes } = await import(
    "@microsoft/applicationinsights-web"
  );
  const ai = new ApplicationInsights({
    config: {
      connectionString: connectionString(),
      distributedTracingMode: DistributedTracingModes.W3C,
      enableCorsCorrelation: false,
      disableAjaxTracking: true,
      disableFetchTracking: false,
      excludeRequestFromAutoTrackingPatterns: [/\/api\/healthz/],
      enableAutoRouteTracking: false,
      enableUnhandledPromiseRejectionTracking: true,
      autoTrackPageVisitTime: true,
    },
  });
  ai.loadAppInsights();
  ai.addTelemetryInitializer(scrub);
  // item.name is "GET <url>"; item.data holds the URL alone when the SDK sets it
  ai.addDependencyInitializer(({ item }) =>
    isApiCall(item.data ?? item.name?.replace(/^\S+ /, "")),
  );
  return ai;
}

function whenLoadedAndIdle(): Promise<void> {
  return new Promise((resolve) => {
    const idle = () => {
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(() => resolve(), { timeout: 5_000 });
      } else {
        setTimeout(resolve, 1);
      }
    };
    if (document.readyState === "complete") idle();
    else window.addEventListener("load", idle, { once: true });
  });
}

/**
 * Loads the SDK once, after the page has loaded, and replays the buffer. Safe to call more than
 * once; later calls return the same promise. `load` is injectable for tests.
 */
export function initTelemetry(load: SdkLoader = loadSdk): Promise<void> {
  if (!isTelemetryEnabled()) return Promise.resolve();
  if (initStarted) return initStarted;
  initStarted = whenLoadedAndIdle()
    .then(load)
    .then((ai) => {
      sdk = ai;
      const pending = buffer;
      buffer = [];
      for (const call of pending) call(ai);
    })
    .catch(() => {
      // Telemetry must never break the page. Drop the buffer and stay a no-op.
      buffer = [];
    });
  return initStarted;
}

/**
 * Starts a new operation for a route change and records the page view, so each page's API
 * calls group under their own operation ID. `route` is the path pattern, for aggregation.
 */
export function trackPageView(route: string): void {
  run((ai) => {
    ai.getTraceCtx()?.setTraceId(randomHex(32));
    ai.trackPageView({
      name: route,
      uri: String(stripHash(window.location.href)),
      properties: { route },
    });
  });
}

export function trackEvent(name: TelemetryEvent, props?: TelemetryProperties): void {
  const properties = sanitizeProperties(props);
  run((ai) => ai.trackEvent({ name }, properties));
}

export function trackMetric(
  name: TelemetryMetric,
  value: number,
  props?: TelemetryProperties,
): void {
  const properties = sanitizeProperties(props);
  run((ai) => ai.trackMetric({ name, average: value }, properties));
}

/**
 * The pseudonymous user ID: the first 16 hex characters of SHA-256 of the account `oid`. The
 * API computes the same value (`backend/src/Ishqnama.Api/Helpers/UserHash.cs`), so browser and
 * API telemetry for one reader line up without the raw account ID leaving the app.
 */
export async function hashUserId(oid: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(oid));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/** Sets or clears the signed-in reader on all later telemetry. */
export function setUser(oid: string | null | undefined): void {
  if (!isTelemetryEnabled()) return;
  if (!oid) {
    run((ai) => ai.clearAuthenticatedUserContext());
    return;
  }
  void hashUserId(oid).then((hash) =>
    run((ai) => ai.setAuthenticatedUserContext(hash, undefined, true)),
  );
}

/**
 * A W3C `traceparent` for an API request, joining the current page's operation: the SDK's
 * trace ID plus a fresh span ID. `undefined` before the SDK has loaded or when disabled.
 */
export function traceparentHeader(): string | undefined {
  const traceId = sdk?.getTraceCtx()?.getTraceId();
  if (!traceId || !/^[0-9a-f]{32}$/.test(traceId)) return undefined;
  return `00-${traceId}-${randomHex(16)}-01`;
}

/**
 * The route pattern for a pathname, so metrics aggregate across chapters: number-only segments
 * become `[n]`, e.g. `/quran/2/ruku/3/` → `/quran/[n]/ruku/[n]/`.
 */
export function routePattern(pathname: string): string {
  return pathname.replace(/\/\d+(?=\/|$)/g, "/[n]");
}

/** Test-only: returns the module to its initial state. */
export function resetTelemetry(): void {
  sdk = null;
  buffer = [];
  initStarted = null;
}
