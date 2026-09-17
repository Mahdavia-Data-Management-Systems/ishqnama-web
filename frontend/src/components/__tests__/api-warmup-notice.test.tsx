import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiWarmupNotice from "@/components/api-warmup-notice";
import { TRY_AGAIN_LABEL, UNREACHABLE_MESSAGE, WARMING_MESSAGE } from "@/config/readiness-copy";
import {
  GRACE_MS,
  markProbeSettled,
  markProbeStarted,
  resetApiReadiness,
  setProbe,
} from "@/lib/api-readiness";

describe("ApiWarmupNotice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders an empty live region while the API state is unknown", () => {
    render(<ApiWarmupNotice />);
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("");
  });

  it("shows the warming message once the probe has hung past the grace period", () => {
    render(<ApiWarmupNotice />);
    act(() => {
      markProbeStarted();
      vi.advanceTimersByTime(GRACE_MS);
    });
    expect(screen.getByText(WARMING_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the unreachable message with a Try again button that requests a probe", () => {
    const probe = vi.fn();
    setProbe(probe);
    render(<ApiWarmupNotice />);
    act(() => {
      markProbeStarted();
      markProbeSettled(false);
    });
    expect(screen.getByText(UNREACHABLE_MESSAGE)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: TRY_AGAIN_LABEL }));
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("clears the message shortly after the API becomes ready", () => {
    render(<ApiWarmupNotice />);
    act(() => {
      markProbeStarted();
      vi.advanceTimersByTime(GRACE_MS);
    });
    expect(screen.getByText(WARMING_MESSAGE)).toBeTruthy();
    act(() => {
      markProbeSettled(true);
    });
    // Still visible during the fade-out.
    expect(screen.getByText(WARMING_MESSAGE)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(screen.queryByText(WARMING_MESSAGE)).toBeNull();
  });
});
