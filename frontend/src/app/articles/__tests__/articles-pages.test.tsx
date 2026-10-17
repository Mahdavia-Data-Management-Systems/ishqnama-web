import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArticlesPage from "@/app/articles/page";
import EssayLayout from "@/app/articles/nooreimaan/[slug]/layout";
import EssayPage, { generateMetadata, generateStaticParams } from "@/app/articles/nooreimaan/[slug]/page";
import ReflectionsPage, {
  generateMetadata as reflectionsMetadata,
  generateStaticParams as reflectionsStaticParams,
} from "@/app/articles/nooreimaan/[slug]/reflections/page";
import { essayReflections } from "@/data/articles/nooreimaan";

// next.config sets trailingSlash; Link reads this flag when it loads, so set it first.
vi.hoisted(() => {
  process.env.__NEXT_TRAILING_SLASH = "true";
});

// The segment under [slug]: null on the essay page, "reflections" on the other.
const navigation = vi.hoisted(() => ({ segment: null as string | null }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSelectedLayoutSegment: () => navigation.segment,
}));

const shareVerse = vi.hoisted(() => vi.fn(async () => "copied" as const));
vi.mock("@/lib/share-verse", () => ({ shareVerse }));

vi.mock("@/components/articles/essay-gate", () => ({
  default: ({ slug }: { slug: string }) => <p>gate {slug}</p>,
}));

vi.mock("@/components/articles/essay-reader", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="essay-reader">{children}</div>,
}));

const params = (slug: string) => Promise.resolve({ slug });

/** An essay page as the browser gets it: the shared head around the page's own content. */
async function renderEssayPage(slug: string, page: "article" | "reflections") {
  navigation.segment = page === "reflections" ? "reflections" : null;
  const child = page === "reflections" ? await ReflectionsPage({ params: params(slug) }) : await EssayPage({ params: params(slug) });
  render(await EssayLayout({ params: params(slug), children: child }));
}

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

  it("prerenders one page per essay, and a reflections page only for essays with recordings", () => {
    expect(generateStaticParams()).toHaveLength(22);
    const withReflections = reflectionsStaticParams().map((p) => p.slug);
    expect(withReflections).toContain("harf-e-zaid");
    expect(withReflections).not.toContain("amanat");
    expect(withReflections.length).toBeLessThan(22);
  });

  it("titles an essay in English for link previews", async () => {
    const metadata = await generateMetadata({ params: params("naskh") });
    expect(metadata.title).toEqual({ absolute: "Naskh (abrogation) | Ishqnama" });
  });

  it("titles the reflections after the essay, and gives an essay without recordings none", async () => {
    const metadata = await reflectionsMetadata({ params: params("naskh") });
    expect(metadata.title).toEqual({ absolute: "Reflections on Naskh (abrogation) | Ishqnama" });
    expect(metadata.openGraph?.url).toBe("/articles/nooreimaan/naskh/reflections/");
    expect(await reflectionsMetadata({ params: params("amanat") })).toEqual({});
  });

  it("shows the titles and neighbours to everyone and leaves the text to the gate", async () => {
    await renderEssayPage("harf-e-zaid", "article");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("حرف زائد");
    expect(within(screen.getByTestId("essay-reader")).getByText("gate harf-e-zaid")).toBeTruthy();
    expect(screen.getByRole("link", { name: /نسخ/ }).getAttribute("href")).toBe("/articles/nooreimaan/naskh/");
    expect(screen.getByRole("link", { name: /استثناء منقطع/ }).getAttribute("href")).toBe(
      "/articles/nooreimaan/istisna-munqati/",
    );
    expect(screen.getByRole("link", { name: "Articles" }).getAttribute("href")).toBe("/articles/");
    expect(screen.queryByRole("link", { name: "Noor e Imaan" })).toBeNull();
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
  });

  it("offers the Article and Reflections pages under the title, with the essay current", async () => {
    await renderEssayPage("harf-e-zaid", "article");
    const tabs = within(screen.getByRole("navigation", { name: "Essay pages" }));
    const article = tabs.getByRole("link", { name: "Article" });
    const reflections = tabs.getByRole("link", { name: "Reflections" });
    expect(article.getAttribute("href")).toBe("/articles/nooreimaan/harf-e-zaid/");
    expect(reflections.getAttribute("href")).toBe("/articles/nooreimaan/harf-e-zaid/reflections/");
    expect(article.getAttribute("aria-current")).toBe("page");
    expect(reflections.getAttribute("aria-current")).toBeNull();
  });

  it("shares the link of the page that is showing: the essay, or its reflections", async () => {
    await renderEssayPage("harf-e-zaid", "article");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(shareVerse).toHaveBeenLastCalledWith({
      title: "Harf-e-zaid (redundant letters)",
      text: "Noor-e-Imaan | حرف زائد\nHarf-e-zaid (redundant letters)\n",
      url: `${window.location.origin}/articles/nooreimaan/harf-e-zaid/`,
    });
    cleanup();

    await renderEssayPage("harf-e-zaid", "reflections");
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(shareVerse).toHaveBeenLastCalledWith({
      title: "Reflections on Harf-e-zaid (redundant letters)",
      text: "Noor-e-Imaan | حرف زائد\nReflections on Harf-e-zaid (redundant letters)\n",
      url: `${window.location.origin}/articles/nooreimaan/harf-e-zaid/reflections/`,
    });
  });

  it("shows no tabs on an essay without recordings", async () => {
    expect(essayReflections("amanat")).toEqual([]);
    await renderEssayPage("amanat", "article");
    expect(screen.getByRole("heading", { level: 1 })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Essay pages" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Reflections" })).toBeNull();
  });

  it("keeps the same head and tabs on the reflections page, with Reflections current", async () => {
    await renderEssayPage("harf-e-zaid", "reflections");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("حرف زائد");
    expect(screen.getByRole("link", { name: "Articles" }).getAttribute("href")).toBe("/articles/");
    const tabs = within(screen.getByRole("navigation", { name: "Essay pages" }));
    expect(tabs.getByRole("link", { name: "Article" }).getAttribute("aria-current")).toBeNull();
    expect(tabs.getByRole("link", { name: "Reflections" }).getAttribute("aria-current")).toBe("page");
    // One entry per recording, named by its caption
    const reflections = essayReflections("harf-e-zaid");
    const items = within(screen.getByRole("region", { name: "Reflections" })).getAllByRole("listitem");
    expect(items).toHaveLength(reflections.length);
    for (const reflection of reflections) {
      expect(screen.getByRole("heading", { level: 2, name: reflection.caption ?? reflection.title })).toBeTruthy();
    }
    // The essay's own furniture stays on its own page
    expect(screen.queryByTestId("essay-reader")).toBeNull();
    expect(screen.queryByRole("navigation", { name: "More essays" })).toBeNull();
  });
});
