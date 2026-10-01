import { GRACE_MS, getApiReadiness, subscribeApiReadiness } from "@/lib/api-readiness";
import { trackEvent, trackMetric } from "@/lib/telemetry";

/**
 * Reports cold starts from the reader's side by watching the readiness store: when it moves from
 * `warming` (the probe hung past the grace period) to `ready`, the wait since the probe started
 * goes out as `api-warmup-ms`. Each move to `unreachable` sends `api-unreachable`. Observation
 * only: the store's behaviour is unchanged. Returns the unsubscribe function.
 */
export function observeApiWarmup(): () => void {
  let previous = getApiReadiness();
  let probeStartedAt: number | null = null;

  return subscribeApiReadiness(() => {
    const next = getApiReadiness();
    if (next === previous) return;

    if (next === "warming" && probeStartedAt === null) {
      // The store turns "warming" GRACE_MS after the probe was sent
      probeStartedAt = performance.now() - GRACE_MS;
    } else if (next === "unreachable") {
      trackEvent("api-unreachable");
    } else if (next === "ready" && probeStartedAt !== null) {
      trackMetric("api-warmup-ms", Math.round(performance.now() - probeStartedAt));
      probeStartedAt = null;
    }

    previous = next;
  });
}
