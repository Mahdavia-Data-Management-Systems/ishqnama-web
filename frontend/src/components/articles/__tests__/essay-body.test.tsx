import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EssayBody from "@/components/articles/essay-body";
import type { Block } from "@/types/articles";

const BLOCKS: Block[] = [
  { type: "h2", id: "section-1", runs: [{ kind: "urdu", text: "پہلی آیت" }] },
  {
    type: "p",
    runs: [
      { kind: "urdu", text: "قرآن میں " },
      { kind: "quran", text: "إِنَّمَا" },
      { kind: "arabic", text: "الفوز الکبیر" },
      { kind: "farsi", text: "فارسی" },
      { kind: "english", text: "Al-Fauz, p. 4" },
    ],
  },
  {
    type: "pair",
    rows: [
      {
        quote: [[{ kind: "arabic", text: "ولم يراع" }]],
        rendering: [[{ kind: "urdu", text: "اور" }], [{ kind: "urdu", text: "دوسرا" }]],
      },
    ],
  },
];

describe("EssayBody", () => {
  afterEach(cleanup);

  it("sets the essay as right-to-left Urdu", () => {
    const { container } = render(<EssayBody blocks={BLOCKS} />);
    const root = container.firstElementChild!;
    expect(root.getAttribute("lang")).toBe("ur");
    expect(root.getAttribute("dir")).toBe("rtl");
  });

  it("marks each run's language, and keeps English left-to-right", () => {
    render(<EssayBody blocks={BLOCKS} />);
    const quran = screen.getByText("إِنَّمَا");
    expect(quran.getAttribute("lang")).toBe("ar");
    expect(quran.dataset.kind).toBe("quran");
    expect(screen.getByText("الفوز الکبیر").dataset.kind).toBe("arabic");
    expect(screen.getByText("فارسی").getAttribute("lang")).toBe("fa");
    const english = screen.getByText("Al-Fauz, p. 4");
    expect(english.getAttribute("lang")).toBe("en");
    expect(english.getAttribute("dir")).toBe("ltr");
  });

  it("gives subheadings their ids and lists them in a contents nav", () => {
    render(<EssayBody blocks={BLOCKS} />);
    expect(screen.getByRole("heading", { level: 2, name: "پہلی آیت" }).id).toBe("section-1");
    const link = screen.getByRole("link", { name: "پہلی آیت" });
    expect(link.getAttribute("href")).toBe("#section-1");
  });

  it("has no contents nav for an essay without subheadings", () => {
    render(<EssayBody blocks={BLOCKS.slice(1)} />);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("sets a table row as a figure: the quotation, then its rendering paragraph by paragraph", () => {
    const { container } = render(<EssayBody blocks={BLOCKS} />);
    const figure = container.querySelector("figure")!;
    expect(figure.querySelector("blockquote")?.textContent).toBe("ولم يراع");
    const rendering = figure.querySelectorAll("blockquote + div p");
    expect(Array.from(rendering, (p) => p.textContent)).toEqual(["اور", "دوسرا"]);
  });
});
