"use client";

import { useEffect } from "react";
import { getHealth } from "@/lib/api";
import {
  markOffline,
  markProbeSettled,
  markProbeStarted,
  setProbe,
} from "@/lib/api-readiness";

/**
 * Keeps the scale-to-zero API Container App warm while the site is open, and
 * doubles as the probe behind the readiness store in lib/api-readiness.ts.
 *
 * Azure Container Apps removes the last replica after roughly five minutes
 * without requests. On a reading site a user can sit on one page far longer
 * than that, so the next navigation would pay a cold start. This component
 * pings GET /api/healthz on load and every KEEP_ALIVE_INTERVAL_MS while the
 * tab is visible. It pauses when the tab is hidden (so a forgotten background
 * tab does not keep a replica billed) and pings immediately when the tab
 * becomes visible again or the browser comes back online.
 *
 * Every ping reports to the readiness store: started before the request,
 * settled with the outcome. While the store says the API is unreachable the
 * next ping comes after UNREACHABLE_RETRY_MS instead of the full interval, and
 * the store can ask for a ping on demand (the "Try again" button).
 *
 * /api/healthz is the only safe route to ping: it is anonymous, does not touch
 * the database, and is excluded from the long-lived Cache-Control header that
 * every other /api route carries, so each ping actually reaches the origin.
 */

/** Comfortably under the ~300 s ACA scale-in cooldown, with margin for timer jitter. */
const KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 1000;

/**
 * Cold starts on dev are observed at about 50 s end to end. The ping must
 * outlive one so it can report the API as ready; the ingress queues the
 * request until the replica is up, so waiting is safe.
 */
const KEEP_ALIVE_TIMEOUT_MS = 90_000;

/** While the API is unreachable, probe again this often so recovery is noticed quickly. */
const UNREACHABLE_RETRY_MS = 15_000;

export default function ApiKeepAlive() {
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let retryId: ReturnType<typeof setTimeout> | null = null;
    let inFlight: AbortController | null = null;
    let disposed = false;

    const clearRetry = () => {
      if (retryId !== null) {
        clearTimeout(retryId);
        retryId = null;
      }
    };

    const ping = async () => {
      if (disposed || inFlight) return;
      clearRetry();

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        markOffline();
        return;
      }

      const controller = new AbortController();
      inFlight = controller;
      const timeoutId = setTimeout(
        () => controller.abort(),
        KEEP_ALIVE_TIMEOUT_MS,
      );

      markProbeStarted();
      try {
        await getHealth(controller.signal);
        if (!disposed) markProbeSettled(true);
      } catch (err) {
        // Expected during a cold start that outlasts the timeout, or while
        // offline. The store explains the wait; never surface it here.
        console.debug("API keep-alive ping failed:", err);
        if (!disposed) {
          markProbeSettled(false);
          retryId = setTimeout(() => void ping(), UNREACHABLE_RETRY_MS);
        }
      } finally {
        clearTimeout(timeoutId);
        if (inFlight === controller) inFlight = null;
      }
    };

    const start = () => {
      if (intervalId !== null) return;
      void ping();
      intervalId = setInterval(() => void ping(), KEEP_ALIVE_INTERVAL_MS);
    };

    const stop = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      clearRetry();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    const handleOnline = () => {
      if (document.visibilityState === "visible") void ping();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    setProbe(() => void ping());
    if (document.visibilityState === "visible") start();

    return () => {
      disposed = true;
      setProbe(null);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      stop();
      inFlight?.abort();
    };
  }, []);

  return null;
}
