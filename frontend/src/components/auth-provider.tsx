"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  PublicClientApplication,
  EventType,
  AuthenticationResult,
} from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import { msalConfig } from "@/config/auth-config";

export const msalInstance = new PublicClientApplication(msalConfig);

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    msalInstance.initialize().then(async () => {
      // handleRedirectPromise processes the redirect response and returns
      // the AuthenticationResult if we just came back from a login redirect.
      // This MUST be awaited before checking accounts.
      const response = await msalInstance.handleRedirectPromise();

      if (response?.account) {
        msalInstance.setActiveAccount(response.account);
      } else {
        // No redirect in progress — pick the first cached account
        const accounts = msalInstance.getAllAccounts();
        if (accounts.length > 0 && !msalInstance.getActiveAccount()) {
          msalInstance.setActiveAccount(accounts[0]);
        }
      }

      // Handle future login events (e.g. popup flow or subsequent redirects)
      msalInstance.addEventCallback((event) => {
        if (
          event.eventType === EventType.LOGIN_SUCCESS &&
          event.payload
        ) {
          const result = event.payload as AuthenticationResult;
          msalInstance.setActiveAccount(result.account);
        }
      });

      setIsInitialized(true);
    });
  }, []);

  if (!isInitialized) {
    return null;
  }

  return <MsalProvider instance={msalInstance}>{children}</MsalProvider>;
}
