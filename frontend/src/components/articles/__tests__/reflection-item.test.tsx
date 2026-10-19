import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReflectionItem from "@/components/articles/reflection-item";

const timeline = {
  version: 1,
  audio: "naskh.v1.m4a",
  durationMs: 96896,
  language: "ur",
  speakers: { zoya: { cluster: 0, medianPitchHz: 219, speechMs: 90000 } },
  turns: [{ speaker: "zoya", fromMs: 200, toMs: 4000, expression: "speaking", text: "فرض کریں" }],
};

beforeEach(() => {
  // No card asks for its timeline until it is tapped; this answers the one that is.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(timeline), { status: 200 })));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
});

/**
 * Lays the description out as if `lines` of it fit the card and the whole of it took `contentLines`
 * (every element reports the box's height as its client height, and the content's as its scroll height).
 */
function layOut(lines: number, contentLines: number) {
  const lineHeight = 24;
  const computedStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el) => {
    const style = computedStyle(el);
    Object.defineProperty(style, "lineHeight", { value: `${lineHeight}px` });
    return style;
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => lines * lineHeight });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => contentLines * lineHeight });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(private readonly callback: () => void) {}
      observe() {
        this.callback();
      }
      disconnect() {}
    },
  );
}

describe("ReflectionItem", () => {
  it("names the recording by its caption and shows its description", () => {
    render(
      <ul>
        <ReflectionItem
          reflection={{ title: "نسخ", caption: "Naskh, discussed at length", description: "Hamza and Zoya begin…", url: "articles/nooreimaan/naskh_detail.timeline.v1.json" }}
        />
      </ul>,
    );
    expect(screen.getByRole("listitem")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Naskh, discussed at length" })).toBeTruthy();
    expect(screen.getByText("Hamza and Zoya begin…")).toBeTruthy();
  });

  it("falls back to the title without a caption, and leaves out a missing description", () => {
    render(
      <ul>
        <ReflectionItem reflection={{ title: "نسخ", url: "articles/nooreimaan/naskh.timeline.v1.json" }} />
      </ul>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "نسخ" })).toBeTruthy();
    expect(screen.queryByRole("paragraph")).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText(/\d:\d\d/)).toBeNull();
    // Without art, a plain button opens the discussion; without a description there is no Read more
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Listen to the discussion: نسخ" })).toBeTruthy();
  });

  it("opens the hosts' bubble and starts the recording when the picture is tapped, once per list", async () => {
    render(
      <ul>
        <ReflectionItem
          reflection={{
            title: "نسخ",
            caption: "Naskh (abrogation)",
            thumbnail: { url: "articles/nooreimaan/naskh/naskh.thumbnail.v1.webp", title: "*Naskh*", align: "right" },
            url: "articles/nooreimaan/naskh/naskh.timeline.v1.json",
          }}
        />
      </ul>,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole("region", { name: "Discussion" })).toBeNull();

    const picture = screen.getByRole("button", { name: "Listen to the discussion: Naskh (abrogation)" });
    fireEvent.click(picture);
    const bubble = await screen.findByRole("region", { name: "Discussion" }, { timeout: 3000 });
    expect(fetch).toHaveBeenCalledWith("https://audio.ishqnama.com/podcasts/articles/nooreimaan/naskh/naskh.timeline.v1.json");
    expect(bubble.querySelector("audio")?.getAttribute("src")).toBe("https://audio.ishqnama.com/podcasts/articles/nooreimaan/naskh/naskh.v1.m4a");
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(picture.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(within(bubble).getByRole("button", { name: "Close discussion" }));
    expect(screen.queryByRole("region", { name: "Discussion" })).toBeNull();
    expect(picture.getAttribute("aria-pressed")).toBe("false");
  });

  it("says so in the card when the recording cannot be reached", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 404 }));
    render(
      <ul>
        <ReflectionItem reflection={{ title: "نسخ", url: "articles/nooreimaan/naskh.timeline.v1.json" }} />
      </ul>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Listen to the discussion: نسخ" }));
    expect((await screen.findByRole("status", {}, { timeout: 3000 })).textContent).toBe("This discussion isn't available.");
  });

  it("shows the recording's picture card from the art released beside its timeline", () => {
    const { container } = render(
      <ul>
        <ReflectionItem
          reflection={{
            title: "نسخ",
            caption: "Naskh (abrogation)",
            durationMs: 96896,
            thumbnail: { url: "articles/nooreimaan/naskh/naskh.thumbnail.v1.webp", title: "Kya Quran mein *Naskh* hai?", align: "right" },
            url: "articles/nooreimaan/naskh/naskh.timeline.v1.json",
          }}
        />
      </ul>,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://audio.ishqnama.com/podcasts/articles/nooreimaan/naskh/naskh.thumbnail.v1.webp");
    expect(screen.getByText("Naskh").closest("mark")).not.toBeNull();
    expect(screen.getByText("1:37")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Naskh (abrogation)" })).toBeTruthy();
  });

  it("clamps the description to the whole lines that fit and keeps Read more out of reach when nothing was cut", () => {
    layOut(5, 3);
    render(
      <ul>
        <ReflectionItem reflection={{ title: "نسخ", description: "Short.", url: "articles/nooreimaan/naskh.timeline.v1.json" }} />
      </ul>,
    );
    const description = screen.getByText("Short.");
    expect(description.style.getPropertyValue("--description-lines")).toBe("5");
    const readMore = screen.getByRole("button", { name: "Read more" });
    expect(readMore.getAttribute("tabindex")).toBe("-1");
    expect(readMore.parentElement?.dataset.clipped).toBeUndefined();
  });

  it("offers Read more when the description was cut, opening the whole of it in a dialog", () => {
    layOut(5, 9);
    render(
      <ul>
        <ReflectionItem
          reflection={{ title: "نسخ", caption: "Naskh, discussed at length", description: "The whole description.", url: "articles/nooreimaan/naskh.timeline.v1.json" }}
        />
      </ul>,
    );
    const readMore = screen.getByRole("button", { name: "Read more" });
    expect(readMore.parentElement?.dataset.clipped).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(readMore);
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(within(dialog).getByRole("heading", { level: 2, name: "Naskh, discussed at length" })).toBeTruthy();
    expect(within(dialog).getByText("The whole description.")).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close" }));

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(readMore);
  });
});
