import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArticlesPage from "@/app/articles/page";
import EssayPage, { generateMetadata, generateStaticParams } from "@/app/articles/nooreimaan/[slug]/page";

// next.config sets trailingSlash; Link reads this flag when it loads, so set it first.
vi.hoisted(() => {
  process.env.__NEXT_TRAILING_SLASH = "true";
});

vi.mock("@/components/articles/essay-gate", () => ({
  default: ({ slug }: { slug: string }) => <p>gate {slug}</p>,
}));

describe("articles pages", () => {
  afterEach(cleanup);

  it("lists every essay in book order, then the dua on its own page", () => {
    render(<ArticlesPage />);
    const links = within(screen.getByRole("list")).getAllByRole("link");
    expect(links).toHaveLength(23);
    expect(links[0].getAttribute("href")).toBe("/articles/nooreimaan/is-the-quran-connected/");
    expect(links[22].getAttribute("href")).toBe("/nooreimaan/dua/");
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
  });

  it("prerenders one page per essay", () => {
    expect(generateStaticParams()).toHaveLength(22);
  });

  it("titles an essay in English for link previews", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "naskh" }) });
    expect(metadata.title).toEqual({ absolute: "Naskh (abrogation) | Ishqnama" });
  });

  it("shows the titles and neighbours to everyone and leaves the text to the gate", async () => {
    render(await EssayPage({ params: Promise.resolve({ slug: "harf-e-zaid" }) }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("حرف زائد");
    expect(screen.getByText("gate harf-e-zaid")).toBeTruthy();
    expect(screen.getByRole("link", { name: /نسخ/ }).getAttribute("href")).toBe("/articles/nooreimaan/naskh/");
    expect(screen.getByRole("link", { name: /استثناء منقطع/ }).getAttribute("href")).toBe(
      "/articles/nooreimaan/istisna-munqati/",
    );
    expect(screen.queryByRole("link", { name: "All articles" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Noor e Imaan" })).toBeNull();
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
  });
});
