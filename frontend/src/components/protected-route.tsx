"use client";

import { ReactNode } from "react";
import {
  MsalAuthenticationTemplate,
  MsalAuthenticationResult,
} from "@azure/msal-react";
import { InteractionType } from "@azure/msal-browser";
import { loginRequest } from "@/config/auth-config";

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

function ErrorComponent({ error }: MsalAuthenticationResult) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "50vh",
        gap: "var(--space-3)",
        padding: "0 var(--space-6)",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "var(--text-xl)",
          color: "var(--text-primary)",
        }}
      >
        Unable to sign in
      </p>
      <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-base)" }}>
        {error?.message ?? "An unexpected error occurred. Please try again."}
      </p>
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
