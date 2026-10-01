import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRACE_MS, markProbeSettled, markProbeStarted, resetApiReadiness } from "@/lib/api-readiness";
import { observeApiWarmup } from "@/lib/api-warmup-telemetry";
import * as telemetry from "@/lib/telemetry";

describe("observeApiWarmup", () => {
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
    vi.spyOn(telemetry, "trackMetric").mockImplementation(() => {});
    vi.spyOn(telemetry, "trackEvent").mockImplementation(() => {});
    stop = observeApiWarmup();
  });

  afterEach(() => {
    stop();
    resetApiReadiness();
    vi.useRealTimers();
  });

  it("reports the wait from probe start when a cold start ends", () => {
    markProbeStarted();
    vi.advanceTimersByTime(GRACE_MS + 47_000);
    markProbeSettled(true);
    expect(telemetry.trackMetric).toHaveBeenCalledWith("api-warmup-ms", GRACE_MS + 47_000);
  });

  it("reports nothing when the probe answers within the grace period", () => {
    markProbeStarted();
    vi.advanceTimersByTime(200);
    markProbeSettled(true);
    expect(telemetry.trackMetric).not.toHaveBeenCalled();
  });

  it("sends an event when the probe fails", () => {
    markProbeStarted();
    markProbeSettled(false);
    expect(telemetry.trackEvent).toHaveBeenCalledWith("api-unreachable");
  });
});
