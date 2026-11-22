import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AyahBlock from "@/components/scripture/ayah-block";
import styles from "@/components/scripture/ayah-block.module.css";

afterEach(cleanup);

function renderBlock(props: Partial<React.ComponentProps<typeof AyahBlock>> = {}) {
  return render(<AyahBlock chapterNumber={2} number={255} arabic="ٱللَّهُ" activeLang="english" {...props} />);
}

describe("AyahBlock recitation control", () => {
  it("offers Play recitation first among the actions and hands over the button", () => {
    const onPlay = vi.fn();
    renderBlock({ onPlay });
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].getAttribute("aria-label")).toBe("Play recitation");
    fireEvent.click(buttons[0]);
    expect(onPlay).toHaveBeenCalledWith(buttons[0]);
  });

  it("shows Pause, pressed, and the reading wash while this verse is being read", () => {
    renderBlock({ onPlay: () => {}, isReading: true });
    const button = screen.getByRole("button", { name: "Pause" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById("verse-2-255")?.classList.contains(styles.reading)).toBe(true);
  });

  it("offers Play recitation again, still pressed and washed, while this verse is paused", () => {
    renderBlock({ onPlay: () => {}, isReading: true, isPaused: true });
    const button = screen.getByRole("button", { name: "Play recitation" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    expect(document.getElementById("verse-2-255")?.classList.contains(styles.reading)).toBe(true);
  });
});

describe("AyahBlock takhreej", () => {
  const segments = [
    {
      text: "ترجمہ",
      explanation: 'شرح <mark>اقتباس<ins data-takhreej="1"></ins></mark> باقی',
      takhreej: [{ ordinal: 1, citations: [{ title: "جامع البيان" }] }],
    },
  ];
  const tafseer = () => screen.getByText("شرح", { exact: false }).closest(`.${styles.tafseer}`)!;

  it("opens a passage's takhreej without highlighting the tafseer it sits in", () => {
    renderBlock({ segments, showTafseer: true, activeLang: "urdu" });
    fireEvent.click(screen.getByRole("button", { name: "Show takhreej" }));
    expect(screen.getByRole("dialog", { name: "Takhreej" })).toBeTruthy();
    expect(tafseer().classList.contains(styles.segHighlight)).toBe(false);

    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(tafseer());
    expect(tafseer().classList.contains(styles.segHighlight)).toBe(true);
  });

  it("shows the passage as ordinary tafseer when the reader has turned takhreej off", () => {
    renderBlock({ segments, showTafseer: true, showTakhreej: false, activeLang: "urdu" });
    expect(screen.queryByRole("button", { name: "Show takhreej" })).toBeNull();
    expect(tafseer().querySelector("mark")).toBeNull();
    expect(tafseer().textContent).toContain("شرح اقتباس باقی");
  });

  it("shows no takhreej while tafseer is hidden", () => {
    renderBlock({ segments, showTafseer: false, activeLang: "urdu" });
    expect(screen.queryByRole("button", { name: "Show takhreej" })).toBeNull();
  });
});
