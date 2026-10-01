import { describe, expect, it } from "vitest";
import { DISALLOWED_PATHS, robotsFor } from "../robots";

describe("robotsFor", () => {
  it.each(["https://ishqnama.com", "https://www.ishqnama.com"])(
    "lets crawlers into %s except the account-only routes",
    (origin) => {
      expect(robotsFor(new URL(origin))).toEqual({
        rules: { userAgent: "*", allow: "/", disallow: DISALLOWED_PATHS },
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
});
