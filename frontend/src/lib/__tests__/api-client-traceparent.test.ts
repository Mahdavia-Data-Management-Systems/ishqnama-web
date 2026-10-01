import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const msal = vi.hoisted(() => ({
  getActiveAccount: vi.fn(),
  acquireTokenSilent: vi.fn(),
}));

vi.mock("@/components/auth-provider", () => ({ msalInstance: msal }));
vi.mock("@/config/auth-config", () => ({ apiScope: "api://test/access" }));
vi.mock("@/lib/telemetry", () => ({
  traceparentHeader: () => "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
}));

describe("api-client traceparent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.test/api");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  function sentHeaders(): Record<string, string> {
    return fetchMock.mock.calls[0][1].headers as Record<string, string>;
  }

  it("leaves anonymous requests without traceparent, so they stay simple CORS requests", async () => {
    msal.getActiveAccount.mockReturnValue(null);
    const { apiFetchWithOptionalAuth } = await import("@/lib/api-client");
    await apiFetchWithOptionalAuth("/chapters");
    expect(sentHeaders()).not.toHaveProperty("traceparent");
    expect(sentHeaders()).not.toHaveProperty("Authorization");
  });

  it("adds traceparent next to the token on an optionally authenticated request", async () => {
    msal.getActiveAccount.mockReturnValue({ homeAccountId: "h" });
    msal.acquireTokenSilent.mockResolvedValue({ accessToken: "token" });
    const { apiFetchWithOptionalAuth } = await import("@/lib/api-client");
    await apiFetchWithOptionalAuth("/chapters/1/verses");
    expect(sentHeaders()).toMatchObject({
      Authorization: "Bearer token",
      traceparent: expect.stringMatching(/^00-/),
    });
  });

  it("adds traceparent on an authenticated request", async () => {
    msal.getActiveAccount.mockReturnValue({ homeAccountId: "h" });
    msal.acquireTokenSilent.mockResolvedValue({ accessToken: "token" });
    const { authenticatedApiFetch } = await import("@/lib/api-client");
    await authenticatedApiFetch("/user/settings");
    expect(sentHeaders()).toHaveProperty("traceparent");
  });
});
