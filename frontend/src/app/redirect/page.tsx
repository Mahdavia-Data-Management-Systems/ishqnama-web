"use client";

import { useEffect, useState } from "react";
import { broadcastResponseToMainFrame } from "@azure/msal-browser/redirect-bridge";

/**
 * MSAL redirect bridge. Every MSAL flow (silent iframe renewal, popup, and the
 * full-page login redirect) lands here. For iframe/popup flows the bridge posts
 * the auth response to the frame that started the request; for the redirect
 * flow it navigates back to the page that called loginRedirect.
 *
 * AppShell renders this route without AuthProvider or any app chrome so that
 * nothing else touches the URL hash or calls MSAL before the bridge runs.
 */
export default function RedirectBridgePage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    broadcastResponseToMainFrame().catch((error: unknown) => {
      // Reached when the page is opened directly, with no auth response in the URL.
      console.error("[MSAL] redirect bridge:", error);
      setFailed(true);
    });
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
        padding: "var(--space-6)",
        textAlign: "center",
        color: "var(--text-tertiary)",
        fontSize: "var(--text-base)",
      }}
    >
      {failed ? (
        <>
          <p>There is no sign-in to complete on this page.</p>
          <a href="/" style={{ color: "var(--teal-primary)" }}>
            Return to Ishqnama
          </a>
        </>
      ) : (
        <p>Completing sign-in…</p>
      )}
    </main>
  );
}
