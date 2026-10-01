"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { observeApiWarmup } from "@/lib/api-warmup-telemetry";
import { initTelemetry, routePattern, trackMetric, trackPageView } from "@/lib/telemetry";

type WebVital = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

let landingRoute: string | null = null;

/**
 * Core Web Vitals describe the page load the reader landed on, even when LCP or CLS is only
 * reported after a client-side navigation, so they carry the landing route. Module-level so the
 * callback is stable: useReportWebVitals re-subscribes, and re-reports, when it changes.
 */
function reportWebVital(metric: WebVital) {
  landingRoute ??= routePattern(window.location.pathname);
  trackMetric(`web-vital-${metric.name}`, metric.value, {
    rating: metric.rating,
    route: landingRoute,
  });
}

/**
 * Real-user monitoring: loads Application Insights after the page has loaded, records a page view
 * per route, Core Web Vitals and cold-start waits. Mounted in app-shell.tsx outside AuthProvider,
 * and skipped on the redirect bridge route like the rest of the shell. Renders nothing.
 */
export default function Telemetry() {
  const pathname = usePathname();

  useEffect(() => {
    landingRoute ??= routePattern(window.location.pathname);
    void initTelemetry();
    return observeApiWarmup();
  }, []);

  useEffect(() => {
    if (pathname) trackPageView(routePattern(pathname));
  }, [pathname]);

  useReportWebVitals(reportWebVital);

  return null;
}
