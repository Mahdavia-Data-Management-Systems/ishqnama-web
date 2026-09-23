"use client";

import { ReactNode, useMemo } from "react";
import {
  MsalAuthenticationTemplate,
  MsalAuthenticationResult,
  useMsal,
} from "@azure/msal-react";
import { InteractionType, RedirectRequest } from "@azure/msal-browser";
import { loginRequest } from "@/config/auth-config";
import { interactiveRequestFor } from "@/lib/account-hints";
import AuthLoading from "@/components/auth-loading";
import EmptyState from "@/components/empty-state";

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
            // No request: the template reuses the one passed to it below.
            login(InteractionType.Redirect).catch(() => {
              // Failures surface through MsalAuthenticationTemplate's error state
            });
          },
        }}
      />
    </div>
  );
}

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { instance } = useMsal();
  // getActiveAccount() builds a fresh object on every call, so key the memo on the account id.
  const accountId = instance.getActiveAccount()?.homeAccountId;
  // When a cached account exists (a returning reader whose 24-hour sign-in has lapsed), hint
  // Entra with their email and provider so its page does not show the GUID principal name.
  // Memoised because msal-react re-creates its login callback whenever this object changes.
  const request = useMemo<RedirectRequest>(() => {
    const account = accountId ? instance.getActiveAccount() : null;
    return account ? interactiveRequestFor(account, loginRequest.scopes) : loginRequest;
  }, [instance, accountId]);

  return (
    <MsalAuthenticationTemplate
      interactionType={InteractionType.Redirect}
      authenticationRequest={request}
      loadingComponent={AuthLoading}
      errorComponent={ErrorComponent}
    >
      {children}
    </MsalAuthenticationTemplate>
  );
}
