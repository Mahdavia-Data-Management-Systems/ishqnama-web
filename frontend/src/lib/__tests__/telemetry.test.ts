import type { ApplicationInsights } from "@microsoft/applicationinsights-web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUFFER_LIMIT,
  hashUserId,
  initTelemetry,
  isApiCall,
  resetTelemetry,
  routePattern,
  setUser,
  trackEvent,
  trackPageView,
  traceparentHeader,
} from "@/lib/telemetry";

const TRACE_ID = "0af7651916cd43dd8448eb211c80319c";

function fakeSdk() {
  let traceId = TRACE_ID;
  const traceCtx = {
    getTraceId: () => traceId,
    setTraceId: (id: string) => {
      traceId = id;
    },
  };
  return {
    trackEvent: vi.fn(),
    trackMetric: vi.fn(),
    trackPageView: vi.fn(),
    setAuthenticatedUserContext: vi.fn(),
    clearAuthenticatedUserContext: vi.fn(),
    getTraceCtx: () => traceCtx,
  };
}

function loaderFor(sdk: ReturnType<typeof fakeSdk>) {
  return () => Promise.resolve(sdk as unknown as ApplicationInsights);
}

describe("telemetry", () => {
  beforeEach(() => {
    resetTelemetry();
    vi.stubEnv("NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING", "InstrumentationKey=test");
  });

  afterEach(() => {
    resetTelemetry();
    vi.unstubAllEnvs();
  });

  it("does nothing without a connection string", async () => {
    vi.stubEnv("NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING", "");
    const sdk = fakeSdk();
    const load = vi.fn(loaderFor(sdk));
    trackEvent("theme-changed", { theme: "dark" });
    await initTelemetry(load);
    expect(load).not.toHaveBeenCalled();
    expect(traceparentHeader()).toBeUndefined();
  });

  it("buffers calls made before the SDK loads and replays them in order", async () => {
    const sdk = fakeSdk();
    trackEvent("theme-changed", { theme: "dark" });
    trackEvent("index-view-changed", { view: "juz" });
    expect(sdk.trackEvent).not.toHaveBeenCalled();

    await initTelemetry(loaderFor(sdk));

    expect(sdk.trackEvent.mock.calls.map((c) => c[0].name)).toEqual([
      "theme-changed",
      "index-view-changed",
    ]);
  });

  it("keeps only the newest calls once the buffer is full", async () => {
    const sdk = fakeSdk();
    for (let i = 0; i < BUFFER_LIMIT + 5; i++) trackEvent("bookmark-created", { resultCount: i });
    await initTelemetry(loaderFor(sdk));
    expect(sdk.trackEvent).toHaveBeenCalledTimes(BUFFER_LIMIT);
    expect(sdk.trackEvent.mock.calls[0][1]).toEqual({ resultCount: 5 });
  });

  it("drops property keys outside the allowlist", async () => {
    const sdk = fakeSdk();
    await initTelemetry(loaderFor(sdk));
    trackEvent("search-submitted", { resultCount: 3, query: "light" } as never);
    expect(sdk.trackEvent).toHaveBeenCalledWith({ name: "search-submitted" }, { resultCount: 3 });
  });

  it("builds a traceparent on the current operation once loaded", async () => {
    expect(traceparentHeader()).toBeUndefined();
    await initTelemetry(loaderFor(fakeSdk()));
    const header = traceparentHeader();
    expect(header).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(header?.split("-")[1]).toBe(TRACE_ID);
  });

  it("starts a new operation for each page view", async () => {
    const sdk = fakeSdk();
    await initTelemetry(loaderFor(sdk));
    trackPageView("/quran/[n]/");
    const traceId = traceparentHeader()?.split("-")[1];
    expect(traceId).not.toBe(TRACE_ID);
    expect(sdk.trackPageView).toHaveBeenCalledWith(
      expect.objectContaining({ name: "/quran/[n]/", properties: { route: "/quran/[n]/" } }),
    );
  });

  it("hashes the account oid the same way as the API", async () => {
    // Same vector as UserHash.From in the backend
    await expect(hashUserId("11111111-2222-3333-4444-555555555555")).resolves.toBe(
      "666ff6ccaa5b3c07",
    );
  });

  it("sets the hashed user, and clears it on sign-out", async () => {
    const sdk = fakeSdk();
    await initTelemetry(loaderFor(sdk));
    setUser("11111111-2222-3333-4444-555555555555");
    await vi.waitFor(() =>
      expect(sdk.setAuthenticatedUserContext).toHaveBeenCalledWith("666ff6ccaa5b3c07", undefined, true),
    );
    setUser(null);
    expect(sdk.clearAuthenticatedUserContext).toHaveBeenCalledTimes(1);
  });

  it("stays a no-op when the SDK fails to load", async () => {
    trackEvent("theme-changed", { theme: "dark" });
    await expect(initTelemetry(() => Promise.reject(new Error("blocked")))).resolves.toBeUndefined();
    expect(traceparentHeader()).toBeUndefined();
  });
});

describe("routePattern", () => {
  it("replaces number-only segments", () => {
    expect(routePattern("/quran/2/ruku/3/")).toBe("/quran/[n]/ruku/[n]/");
    expect(routePattern("/quran/juz/30/")).toBe("/quran/juz/[n]/");
    expect(routePattern("/saved/")).toBe("/saved/");
    expect(routePattern("/")).toBe("/");
  });
});

describe("isApiCall", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("keeps only calls to the API origin", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.dev.ishqnama.com/api");
    expect(isApiCall("https://api.dev.ishqnama.com/api/user/settings")).toBe(true);
    expect(isApiCall("/quran/2/index.txt?_rsc=abc")).toBe(false);
    expect(isApiCall("https://tenant.ciamlogin.com/oauth2/v2.0/token")).toBe(false);
    expect(isApiCall(undefined)).toBe(false);
  });
});
