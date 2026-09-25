import { describe, expect, it } from "vitest";
import {
  juzMetadata,
  juzRukuMetadata,
  OG_IMAGE,
  pageMetadata,
  siteUrl,
  suraMetadata,
  suraRukuMetadata,
} from "../page-metadata";

describe("siteUrl", () => {
  it("keeps only the origin of a configured URL", () => {
    expect(siteUrl("https://dev.ishqnama.com/some/path").href).toBe("https://dev.ishqnama.com/");
  });

  it.each([undefined, "", "null", "dev.ishqnama.com", "ftp://ishqnama.com"])(
    "falls back to production for %j",
    (value) => {
      expect(siteUrl(value).href).toBe("https://ishqnama.com/");
    },
  );
});

describe("pageMetadata", () => {
  it("gives every page the full card, image included", () => {
    const meta = pageMetadata({ title: "About", description: "d", path: "/about/" });
    expect(meta.title).toEqual({ absolute: "About | Ishqnama" });
    expect(meta.openGraph).toMatchObject({
      title: "About | Ishqnama",
      description: "d",
      url: "/about/",
      siteName: "Ishqnama",
      images: [OG_IMAGE],
    });
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: "About | Ishqnama" });
  });

  it("titles the home page with the site name first", () => {
    const meta = pageMetadata({ description: "d", path: "/" });
    expect(meta.title).toEqual({ absolute: "Ishqnama | Noor e Imaan, The Holy Quran" });
  });
});

describe("reader pages", () => {
  it("names the chapter and its facts", () => {
    const meta = suraMetadata(2);
    expect(meta.openGraph?.title).toBe("al-Baqarah (البقرة), Chapter 2 | Ishqnama");
    expect(meta.description).toContain("286 verses, Madani");
    expect(meta.openGraph?.url).toBe("/quran/2/");
  });

  it("names the chapter ruku", () => {
    const meta = suraRukuMetadata(2, 3, 40);
    expect(meta.openGraph?.title).toBe("al-Baqarah (البقرة), Ruku 3 | Ishqnama");
    expect(meta.description).toContain("ruku 3 of 40 of al-Baqarah");
  });

  it("lists the chapters a juz runs through", () => {
    expect(juzMetadata(1).description).toContain("(al-Fātiḥah and al-Baqarah)");
    expect(juzMetadata(30).description).toContain("(an-Nabaʾ to an-Nās)");
  });

  it("points the juz ruku card at the shared link", () => {
    const meta = juzRukuMetadata(3, 1);
    expect(meta.openGraph?.title).toBe("Juz 3, Ruku 1 | Ishqnama");
    expect(meta.openGraph?.url).toBe("/quran/juz/3/ruku/1/");
  });
});
