import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GRACE_MS,
  getApiReadiness,
  markOffline,
  markProbeSettled,
  markProbeStarted,
  onReady,
  requestProbe,
  resetApiReadiness,
  setProbe,
} from "@/lib/api-readiness";

describe("api-readiness store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts unknown", () => {
    expect(getApiReadiness()).toBe("unknown");
  });

  it("stays unknown until the grace period has passed, then becomes warming", () => {
    markProbeStarted();
    vi.advanceTimersByTime(GRACE_MS - 1);
    expect(getApiReadiness()).toBe("unknown");
    vi.advanceTimersByTime(1);
    expect(getApiReadiness()).toBe("warming");
  });

  it("does not become warming when the probe settles before the grace period", () => {
    markProbeStarted();
    vi.advanceTimersByTime(500);
    markProbeSettled(true);
    vi.advanceTimersByTime(GRACE_MS);
    expect(getApiReadiness()).toBe("ready");
  });

  it("becomes warming again from ready when a later probe hangs", () => {
    markProbeStarted();
    markProbeSettled(true);
    markProbeStarted();
    vi.advanceTimersByTime(GRACE_MS);
    expect(getApiReadiness()).toBe("warming");
  });

  it("becomes unreachable when the probe fails", () => {
    markProbeStarted();
    markProbeSettled(false);
    expect(getApiReadiness()).toBe("unreachable");
  });

  it("does not flip unreachable to warming on a subsequent hanging probe", () => {
    markProbeStarted();
    markProbeSettled(false);
    markProbeStarted();
    vi.advanceTimersByTime(GRACE_MS);
    expect(getApiReadiness()).toBe("unreachable");
  });

  it("markOffline sets unreachable and cancels a pending grace timer", () => {
    markProbeStarted();
    markOffline();
    expect(getApiReadiness()).toBe("unreachable");
    vi.advanceTimersByTime(GRACE_MS);
    expect(getApiReadiness()).toBe("unreachable");
  });

  it("runs onReady callbacks once, in order, when the probe succeeds", () => {
    const calls: string[] = [];
    onReady(() => calls.push("a"));
    onReady(() => calls.push("b"));
    markProbeSettled(true);
    markProbeSettled(true);
    expect(calls).toEqual(["a", "b"]);
  });

  it("does not run an unregistered onReady callback", () => {
    const cb = vi.fn();
    const unregister = onReady(cb);
    unregister();
    markProbeSettled(true);
    expect(cb).not.toHaveBeenCalled();
  });

  it("does not run onReady callbacks on failure", () => {
    const cb = vi.fn();
    onReady(cb);
    markProbeSettled(false);
    expect(cb).not.toHaveBeenCalled();
  });

  it("requestProbe calls the registered probe and is a no-op without one", () => {
    expect(() => requestProbe()).not.toThrow();
    const probe = vi.fn();
    setProbe(probe);
    requestProbe();
    expect(probe).toHaveBeenCalledTimes(1);
    setProbe(null);
    requestProbe();
    expect(probe).toHaveBeenCalledTimes(1);
  });
});
