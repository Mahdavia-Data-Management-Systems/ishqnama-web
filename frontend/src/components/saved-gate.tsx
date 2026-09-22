"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import AuthLoading from "@/components/auth-loading";
import EmptyState from "@/components/empty-state";
import ProtectedRoute from "@/components/protected-route";
import SectionHeading from "@/components/navigation/section-heading";
import { SIGN_IN_COPY, SIGN_IN_LABEL } from "@/config/sign-in-copy";
import { useSignInPrompt } from "@/context/sign-in-prompt-context";

/**
 * Wraps /saved/. While MSAL is still starting, shows the spinner. Once settled: an anonymous
 * reader sees the page shell with the sign-in prompt opened once over it (and an inline way to
 * reopen it); a signed-in reader gets ProtectedRoute as before, which keeps silent renewal and
 * the "Sign in again" error state for expired sessions.
 *
 * ProtectedRoute must not mount before auth has settled: MsalAuthenticationTemplate starts its
 * own redirect the moment inProgress becomes None with no account, which would race the
 * anonymous branch and send the reader away without ever showing the prompt.
 */
export default function SavedGate({ children }: { children: ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const { authSettled, promptSignIn } = useSignInPrompt();
  const anonymous = authSettled && !isAuthenticated;
  const prompted = useRef(false);

  useEffect(() => {
    if (!anonymous || prompted.current) return;
    prompted.current = true;
    promptSignIn("saved");
  }, [anonymous, promptSignIn]);

  if (!authSettled) return <AuthLoading />;

  if (!isAuthenticated) {
    return (
      <main style={{ padding: "var(--space-8) 0 var(--space-16)" }}>
        <div className="page-container">
          <SectionHeading eyebrow="Your library" title="Saved" />
          <EmptyState
            icon="bookmark"
            title={SIGN_IN_COPY.saved.title}
            body={SIGN_IN_COPY.saved.body}
            action={{ label: SIGN_IN_LABEL, onClick: () => promptSignIn("saved") }}
          />
        </div>
      </main>
    );
  }

  return <ProtectedRoute>{children}</ProtectedRoute>;
}
