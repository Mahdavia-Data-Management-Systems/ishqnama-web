import { Configuration, LogLevel } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID ?? "",
    authority: process.env.NEXT_PUBLIC_ENTRA_AUTHORITY ?? "",
    knownAuthorities: [
      new URL(process.env.NEXT_PUBLIC_ENTRA_AUTHORITY ?? "https://placeholder.ciamlogin.com").hostname,
    ],
    redirectUri: process.env.NEXT_PUBLIC_ENTRA_REDIRECT_URI ?? "/",
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
