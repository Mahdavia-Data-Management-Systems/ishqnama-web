import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { msalInstance } from "@/components/auth-provider";
import { apiScope } from "@/config/auth-config";

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

  return response.json() as Promise<T>;
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
      // Only redirect for interactive consent, not for misconfigured scopes
      console.warn("Token acquisition requires interaction:", err.message);
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
}
