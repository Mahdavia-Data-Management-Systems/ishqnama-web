import { describe, expect, it } from "vitest";
import { AI_CRAWLERS, DISALLOWED_PATHS, robotsFor } from "../robots";

describe("robotsFor", () => {
  it.each(["https://ishqnama.com", "https://www.ishqnama.com"])(
    "shuts AI crawlers out of %s and lets the rest in except the account-only routes",
    (origin) => {
      expect(robotsFor(new URL(origin))).toEqual({
        rules: [
          { userAgent: AI_CRAWLERS, disallow: "/" },
          { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
        ],
        sitemap: `${origin}/sitemap.xml`,
      });
    },
  );

  it.each(["https://dev.ishqnama.com", "http://localhost:3000"])("keeps crawlers out of %s", (origin) => {
    expect(robotsFor(new URL(origin))).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });

  it("keeps the MSAL redirect bridge out of search", () => {
    expect(DISALLOWED_PATHS).toContain("/redirect/");
  });

  it("keeps readers' verse lists out of search", () => {
    expect(DISALLOWED_PATHS).toContain("/lists/");
  });

  it("keeps search engines and link previews out of the AI list", () => {
    const lower = AI_CRAWLERS.map((a) => a.toLowerCase());
    for (const agent of ["googlebot", "bingbot", "facebookexternalhit", "whatsapp", "twitterbot", "slackbot"]) {
      expect(lower).not.toContain(agent);
    }
  });

  it.each(["GPTBot", "ClaudeBot", "Google-Extended", "CCBot", "PerplexityBot", "Bytespider"])(
    "names %s",
    (agent) => {
      expect(AI_CRAWLERS).toContain(agent);
    },
  );

  it("lists each crawler once", () => {
    expect(new Set(AI_CRAWLERS.map((a) => a.toLowerCase())).size).toBe(AI_CRAWLERS.length);
  });
});
