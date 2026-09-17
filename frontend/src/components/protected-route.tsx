"use client";

import { ReactNode } from "react";
import {
  MsalAuthenticationTemplate,
  MsalAuthenticationResult,
} from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";
import { loginRequest } from "@/config/auth-config";
import EmptyState from "@/components/empty-state";

function Loading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "50vh",
        gap: "var(--space-4)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(0, 68, 70, 0.1)",
          borderTopColor: "var(--teal-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-base)" }}>
        Signing in...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/**
 * Shown when MsalAuthenticationTemplate could neither find a valid token nor
 * fall back to a login on its own. It only falls back automatically for
 * InteractionRequiredAuthError; anything else (a silent-renewal timeout, a
 * network failure, a blocked iframe) is parked here, so give the reader a way
 * to start a fresh interactive sign-in instead of a dead end.
 */
function ErrorComponent({ error, login }: MsalAuthenticationResult) {
  return (
    <div style={{ minHeight: "50vh", display: "flex", alignItems: "center" }}>
      <EmptyState
        icon="logIn"
        title="Unable to sign in"
        body={
          error?.message
            ? `Your session could not be renewed silently (${error.errorCode || "unknown error"}). Sign in again to continue.`
            : "An unexpected error occurred. Sign in again to continue."
        }
        action={{
          label: "Sign in again",
          onClick: () => {
            login(InteractionType.Redirect, loginRequest).catch(() => {
              // Failures surface through MsalAuthenticationTemplate's error state
            });
          },
        }}
      />
    </div>
  );
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  return (
    <MsalAuthenticationTemplate
      interactionType={InteractionType.Redirect}
      authenticationRequest={loginRequest}
      loadingComponent={Loading}
      errorComponent={ErrorComponent}
    >
      {children}
    </MsalAuthenticationTemplate>
  );
}
