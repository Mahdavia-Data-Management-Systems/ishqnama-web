"use client";

import { useEffect } from "react";
import { getHealth } from "@/lib/api";

/**
 * Keeps the scale-to-zero API Container App warm while the site is open.
 *
 * Azure Container Apps removes the last replica after roughly five minutes
 * without requests. On a reading site a user can sit on one page far longer
 * than that, so the next navigation would pay a cold start. This component
 * pings GET /api/healthz on load and every KEEP_ALIVE_INTERVAL_MS while the
 * tab is visible. It pauses when the tab is hidden (so a forgotten background
 * tab does not keep a replica billed) and pings immediately when the tab
 * becomes visible again.
 *
 * /api/healthz is the only safe route to ping: it is anonymous, does not touch
 * the database, and is excluded from the long-lived Cache-Control header that
 * every other /api route carries, so each ping actually reaches the origin.
 */

/** Comfortably under the ~300 s ACA scale-in cooldown, with margin for timer jitter. */
const KEEP_ALIVE_INTERVAL_MS = 2 * 60 * 1000;

/** Long enough that a ping which itself triggers a cold start is not aborted early. */
const KEEP_ALIVE_TIMEOUT_MS = 30_000;

export default function ApiKeepAlive() {
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let inFlight: AbortController | null = null;
    let disposed = false;

    const ping = async () => {
      if (disposed || inFlight) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;

      const controller = new AbortController();
      inFlight = controller;
      const timeoutId = setTimeout(
        () => controller.abort(),
        KEEP_ALIVE_TIMEOUT_MS,
      );

      try {
        await getHealth(controller.signal);
      } catch (err) {
        // Failures are expected during a cold start or while offline; never
        // surface them to the user.
        console.debug("API keep-alive ping failed:", err);
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
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        start();
      } else {
        stop();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    if (document.visibilityState === "visible") start();

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stop();
      inFlight?.abort();
    };
  }, []);

  return null;
}
