import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalInstance } from "@/components/auth-provider";
import { apiScope } from "@/config/auth-config";
import { beginRequest } from "@/lib/pending-requests";
import { recoverExpiredSession } from "@/lib/session-renewal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
  ) {
    super(`API error ${status}: ${statusText}`);
    this.name = "ApiError";
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | undefined>;
}

export async function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const { params, ...fetchOptions } = options ?? {};

  let url = `${API_BASE_URL}${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      url += `?${qs}`;
    }
  }

  // Counted from the network call to the parsed body so the global loading
  // indicator covers the whole wait; the finally releases it on error or abort.
  const endRequest = beginRequest();
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers: {
        Accept: "application/json",
        ...fetchOptions.headers,
      },
    });

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    return (await response.json()) as T;
  } finally {
    endRequest();
  }
}

/**
 * Like apiFetch, but silently attaches a Bearer token when the user is signed in.
 * Falls back to an unauthenticated request if no account or token acquisition fails.
 */
export async function apiFetchWithOptionalAuth<T>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T> {
  const authHeaders: Record<string, string> = {};

  const account = msalInstance.getActiveAccount();
  if (account) {
    try {
      const result = await msalInstance.acquireTokenSilent({
        scopes: [apiScope],
        account,
      });
      authHeaders.Authorization = `Bearer ${result.accessToken}`;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        // The 24-hour sign-in has lapsed and the hidden iframe could not renew it. Send the
        // reader through Entra once (or sign them out locally if that already failed) rather
        // than silently serving the page without their explanations. The anonymous request
        // below still goes out; when redirecting, the page is about to navigate away anyway.
        await recoverExpiredSession(msalInstance, account, [apiScope]);
      }
    }
  }

  return apiFetch<T>(path, {
    ...options,
    headers: { ...authHeaders, ...options?.headers },
  });
}

interface AuthenticatedFetchOptions extends Omit<RequestInit, "body"> {
  params?: Record<string, string | number | undefined>;
  body?: unknown;
}

export async function authenticatedApiFetch<T>(
  path: string,
  options?: AuthenticatedFetchOptions,
): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const { params, body, ...fetchOptions } = options ?? {};

  let url = `${API_BASE_URL}${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        searchParams.set(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      url += `?${qs}`;
    }
  }

  // Acquire access token
  let accessToken: string;
  const account = msalInstance.getActiveAccount();
  if (!account) {
    throw new Error("No active account — user is not signed in");
  }

  try {
    const result = await msalInstance.acquireTokenSilent({
      scopes: [apiScope],
      account,
    });
    accessToken = result.accessToken;
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      // Same expired-sign-in handling as apiFetchWithOptionalAuth, so a bookmark or settings
      // call on the reader recovers the session too. The error still propagates: with the
      // account cleared the caller is anonymous, and with a redirect under way the page is leaving.
      await recoverExpiredSession(msalInstance, account, [apiScope]);
    }
    throw err;
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const endRequest = beginRequest();
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      throw new ApiError(response.status, response.statusText);
    }

    const text = await response.text();
    return text ? (JSON.parse(text) as T) : (undefined as T);
  } finally {
    endRequest();
  }
}
