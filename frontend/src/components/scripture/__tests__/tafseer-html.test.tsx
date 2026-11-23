import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TafseerHtml from "@/components/scripture/tafseer-html";
import styles from "@/components/scripture/tafseer-html.module.css";
import type { TakhreejBlockDto } from "@/types/api";

const trackEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  routePattern: (pathname: string) => pathname.replace(/\/\d+(?=\/|$)/g, "/[n]"),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/quran/2/" }));

afterEach(() => {
  cleanup();
  trackEvent.mockClear();
});

const ZWJ = "‍";
const HTML =
  'شروع <mark>پہلا اقتباس<ins data-takhreej="1"></ins></mark> درمیان ' +
  '<mark>دوسرا اقتباس<ins data-takhreej="2"></ins></mark> آخر';

const BLOCKS: TakhreejBlockDto[] = [
  {
    ordinal: 1,
    citations: [
      {
        title: "جامع البيان",
        author: "ابن جرير الطبري",
        authorDeathYearHijri: 310,
        reference: "٥/١٣١",
        note: "عن <b>ابن عباس</b>",
        url: "https://example.org/tabari/5/131",
      },
      { title: "مسند أحمد", reference: "رقم ٦٩٣٠", url: "http://example.org/insecure" },
      { title: "انصاف نامہ", url: "https://example.org/insaf" },
    ],
  },
  { ordinal: 2, citations: [{ title: "صحيح مسلم", author: "مسلم", authorDeathYearHijri: 261, reference: "ح٨" }] },
];

const buttons = () => screen.queryAllByRole("button", { name: "Show takhreej" });

describe("TafseerHtml", () => {
  it("renders the one prose span when nothing is cited", () => {
    const { container } = render(<TafseerHtml html={'متن <span lang="ar">الم</span>'} />);
    expect(container.innerHTML).toBe('<span>متن <span lang="ar">الم</span></span>');
    expect(buttons()).toHaveLength(0);
  });

  it("washes each cited passage and ends it with a Show takhreej button", () => {
    const { container } = render(<TafseerHtml html={HTML} takhreej={BLOCKS} />);
    expect(buttons()).toHaveLength(2);
    const marks = [...container.querySelectorAll("mark")];
    expect(marks.map((m) => m.textContent)).toEqual(["پہلا اقتباس", "دوسرا اقتباس"]);
    // The wash is on the wrapper, so it takes in the button after the passage as well.
    const washes = [...container.querySelectorAll(`.${styles.passage}`)];
    expect(washes).toHaveLength(2);
    expect(washes.every((w, i) => w.contains(marks[i]) && w.querySelector("button"))).toBe(true);
    expect(container.textContent).toBe("شروع پہلا اقتباس درمیان دوسرا اقتباس آخر");
    expect(container.querySelector("ins")).toBeNull();
    expect(buttons()[0].getAttribute("aria-expanded")).toBe("false");
  });

  it("shows the button alone, with no wash, for an anchor without a passage", () => {
    const { container } = render(
      <TafseerHtml html={'متن <mark><ins data-takhreej="2"></ins></mark> باقی'} takhreej={BLOCKS} />,
    );
    expect(buttons()).toHaveLength(1);
    expect(container.querySelector("mark")).toBeNull();
    fireEvent.click(buttons()[0]);
    const dialog = screen.getByRole("dialog", { name: "Takhreej" });
    expect(dialog.querySelector("blockquote")).toBeNull();
    expect(within(dialog).getByText("صحيح مسلم")).toBeTruthy();
  });

  it("reads a passage whose books did not arrive as ordinary prose", () => {
    const { container } = render(<TafseerHtml html={HTML} takhreej={null} />);
    expect(buttons()).toHaveLength(0);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toBe("شروع پہلا اقتباس درمیان دوسرا اقتباس آخر");
  });

  it("opens the Takhreej sheet without clicking the block around it", () => {
    const spy = vi.fn();
    render(
      <div onClick={spy}>
        <TafseerHtml html={HTML} takhreej={BLOCKS} />
      </div>,
    );
    fireEvent.click(buttons()[0]);

    expect(spy).not.toHaveBeenCalled();
    expect(buttons()[0].getAttribute("aria-expanded")).toBe("true");
    const dialog = screen.getByRole("dialog", { name: "Takhreej" });
    // Drawn on the page itself, not inside the tafseer block.
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(dialog.querySelector("blockquote")?.textContent).toBe("پہلا اقتباس");

    const items = within(dialog).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toBe(`جامع البيان ابن جرير الطبري ٣١٠ه${ZWJ}٥/١٣١عن <b>ابن عباس</b>`);
    expect(items[1].textContent).toBe("مسند أحمدرقم ٦٩٣٠");
  });

  it("links a reference only to a secure address, and never prints the address", () => {
    render(<TafseerHtml html={HTML} takhreej={BLOCKS} />);
    fireEvent.click(buttons()[0]);
    const dialog = screen.getByRole("dialog", { name: "Takhreej" });

    const links = within(dialog).getAllByRole("link");
    expect(links.map((a) => a.textContent)).toEqual(["٥/١٣١", "انصاف نامہ"]);
    expect(links[0].getAttribute("href")).toBe("https://example.org/tabari/5/131");
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      // The mark that it leaves the site.
      expect(link.querySelector("svg")).not.toBeNull();
    }
    expect(within(dialog).getByText("رقم ٦٩٣٠").closest("a")).toBeNull();
    expect(dialog.textContent).not.toContain("example.org");
  });

  it("shows a note as written, never as markup", () => {
    render(<TafseerHtml html={HTML} takhreej={BLOCKS} />);
    fireEvent.click(buttons()[0]);
    const dialog = screen.getByRole("dialog", { name: "Takhreej" });
    expect(within(dialog).getByText("عن <b>ابن عباس</b>")).toBeTruthy();
    expect(dialog.querySelector("b")).toBeNull();
  });

  it("closes on a tap outside without clicking the block around it", () => {
    const spy = vi.fn();
    render(
      <div onClick={spy}>
        <TafseerHtml html={HTML} takhreej={BLOCKS} />
      </div>,
    );
    fireEvent.click(buttons()[1]);
    const dialog = screen.getByRole("dialog", { name: "Takhreej" });
    fireEvent.click(within(dialog).getByText("صحيح مسلم"));
    expect(screen.queryByRole("dialog")).toBeTruthy();

    fireEvent.click(dialog.parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("closes on Escape and returns focus to its button", () => {
    render(<TafseerHtml html={HTML} takhreej={BLOCKS} />);
    const button = buttons()[1];
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Takhreej" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("lists the lines an older response carries inside the anchor", () => {
    const old = `<mark>اقتباس<ins>تفسير البغوي، ٥١٦ه — ١/٥٩${ZWJ}\nمعاني القرآن، الزجاج ٣١١ه — ١/٥٦${ZWJ}\n</ins></mark> باقی`;
    const { container } = render(<TafseerHtml html={old} />);
    expect(container.textContent).toBe("اقتباس باقی");
    fireEvent.click(buttons()[0]);
    const items = within(screen.getByRole("dialog", { name: "Takhreej" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      "تفسير البغوي، ٥١٦ه — ١/٥٩",
      "معاني القرآن، الزجاج ٣١١ه — ١/٥٦",
    ]);
  });

  it("marks search text in the prose and the passage, never in the books", () => {
    const html = 'مسلم نے کہا <mark>مسلم کا قول<ins data-takhreej="2"></ins></mark>';
    const { container } = render(
      <TafseerHtml html={html} takhreej={BLOCKS} highlightQuery="مسلم" markClassName="hl" />,
    );
    expect(container.querySelectorAll("mark.hl")).toHaveLength(2);
    expect(container.querySelector(`.${styles.passage} mark mark.hl`)).toBeTruthy();

    fireEvent.click(buttons()[0]);
    const dialog = screen.getByRole("dialog", { name: "Takhreej" });
    expect(dialog.querySelector("mark")).toBeNull();
    expect(dialog.textContent).toContain("صحيح مسلم");
  });

  it("records the opening with the route alone", () => {
    render(<TafseerHtml html={HTML} takhreej={BLOCKS} />);
    fireEvent.click(buttons()[0]);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith("takhreej-opened", { route: "/quran/[n]/" });
  });

  it("reads as ordinary tafseer when the reader has turned takhreej off", () => {
    const { container } = render(<TafseerHtml html={HTML} takhreej={BLOCKS} showTakhreej={false} />);
    expect(buttons()).toHaveLength(0);
    expect(container.querySelector("mark")).toBeNull();
    expect(container.innerHTML).toBe("<span>شروع پہلا اقتباس درمیان دوسرا اقتباس آخر</span>");
  });
});
