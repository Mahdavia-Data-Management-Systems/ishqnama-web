import { Configuration, LogLevel } from "@azure/msal-browser";
import { AUTH_REDIRECT_PATH } from "@/lib/auth-redirect";

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID ?? "",
    authority: process.env.NEXT_PUBLIC_ENTRA_AUTHORITY ?? "",
    knownAuthorities: process.env.NEXT_PUBLIC_ENTRA_AUTHORITY 
    ? [new URL(process.env.NEXT_PUBLIC_ENTRA_AUTHORITY).hostname] 
    : [],
    // Must point at the redirect bridge page; MSAL resolves a relative value
    // against the current origin. See src/lib/auth-redirect.ts.
    redirectUri: process.env.NEXT_PUBLIC_ENTRA_REDIRECT_URI ?? AUTH_REDIRECT_PATH,
    postLogoutRedirectUri: "/",
  },
  cache: {
    cacheLocation: "localStorage",
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) console.error("[MSAL]", message);
        else if (level === LogLevel.Warning) console.warn("[MSAL]", message);
        else if (level === LogLevel.Info) console.info("[MSAL]", message);
        else console.debug("[MSAL]", message);
      },
    },
  },
};

export const loginRequest = {
  scopes: ["openid", "profile", "email"],
};

export const apiScope = process.env.NEXT_PUBLIC_ENTRA_API_SCOPE ?? "";
