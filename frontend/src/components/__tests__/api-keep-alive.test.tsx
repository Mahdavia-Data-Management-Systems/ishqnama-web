import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiKeepAlive from "@/components/api-keep-alive";
import { GRACE_MS, getApiReadiness, requestProbe, resetApiReadiness } from "@/lib/api-readiness";
import { getHealth } from "@/lib/api";

vi.mock("@/lib/api", () => ({ getHealth: vi.fn() }));

type Deferred = { promise: Promise<{ status: string }>; resolve: () => void; reject: (e: unknown) => void };

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<{ status: string }>((res, rej) => {
    resolve = () => res({ status: "healthy" });
    reject = rej;
  });
  return { promise, resolve, reject };
}

const mockedGetHealth = vi.mocked(getHealth);

describe("ApiKeepAlive as the readiness probe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
    vi.spyOn(console, "debug").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("marks warming after the grace period and ready when the ping resolves", async () => {
    const d = deferred();
    mockedGetHealth.mockReturnValueOnce(d.promise);

    render(<ApiKeepAlive />);
    expect(mockedGetHealth).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(GRACE_MS);
    });
    expect(getApiReadiness()).toBe("warming");

    await act(async () => {
      d.resolve();
      await d.promise;
    });
    expect(getApiReadiness()).toBe("ready");
  });

  it("does not abort a ping before 90 seconds", async () => {
    const d = deferred();
    mockedGetHealth.mockReturnValueOnce(d.promise);
    render(<ApiKeepAlive />);
    const signal = mockedGetHealth.mock.calls[0][0] as AbortSignal;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(89_000);
    });
    expect(signal.aborted).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(signal.aborted).toBe(true);
  });

  it("marks unreachable on failure and re-pings after 15 seconds", async () => {
    mockedGetHealth.mockRejectedValueOnce(new Error("network"));
    const second = deferred();
    mockedGetHealth.mockReturnValueOnce(second.promise);

    render(<ApiKeepAlive />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(getApiReadiness()).toBe("unreachable");
    expect(mockedGetHealth).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(mockedGetHealth).toHaveBeenCalledTimes(2);
  });

  it("registers itself so requestProbe triggers a ping", async () => {
    mockedGetHealth.mockRejectedValueOnce(new Error("network"));
    mockedGetHealth.mockReturnValueOnce(deferred().promise);

    render(<ApiKeepAlive />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(mockedGetHealth).toHaveBeenCalledTimes(1);

    await act(async () => {
      requestProbe();
    });
    expect(mockedGetHealth).toHaveBeenCalledTimes(2);
  });

  it("marks offline instead of pinging when the browser is offline", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<ApiKeepAlive />);
    expect(mockedGetHealth).not.toHaveBeenCalled();
    expect(getApiReadiness()).toBe("unreachable");
    onLine.mockRestore();
  });
});
