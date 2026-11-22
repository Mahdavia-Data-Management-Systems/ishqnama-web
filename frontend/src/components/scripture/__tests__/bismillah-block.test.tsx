import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import BismillahBlock from "@/components/scripture/bismillah-block";
import styles from "@/components/scripture/bismillah-block.module.css";
import type { DisplaySegment } from "@/hooks/use-chapter-verses";

afterEach(cleanup);

// Both segments number their own passage 1: the books must not be mixed up between them.
const SEGMENTS: DisplaySegment[] = [
  {
    text: "شروع",
    explanation: 'پہلی شرح <mark>پہلا اقتباس<ins data-takhreej="1"></ins></mark>',
    takhreej: [{ ordinal: 1, citations: [{ title: "جامع البيان" }] }],
  },
  { text: "اللہ کے نام سے" },
  {
    text: "جو رحمٰن ہے",
    explanation: 'دوسری شرح <mark>دوسرا اقتباس<ins data-takhreej="1"></ins></mark>',
    takhreej: [{ ordinal: 1, citations: [{ title: "صحيح مسلم" }] }],
  },
];

describe("BismillahBlock tafseer", () => {
  it("shows no explanation without segments", () => {
    const { container } = render(<BismillahBlock arabic="بِسْمِ" translation="شروع" />);
    expect(container.querySelector(`.${styles.explanation}`)).toBeNull();
  });

  it("shows each segment's explanation in order, with its own takhreej", () => {
    const { container } = render(<BismillahBlock arabic="بِسْمِ" segments={SEGMENTS} />);
    const explanation = container.querySelector(`.${styles.explanation}`)!;
    expect(explanation.textContent).toBe("پہلی شرح پہلا اقتباس دوسری شرح دوسرا اقتباس");

    const buttons = screen.getAllByRole("button", { name: "Show takhreej" });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[1]);
    const dialog = screen.getByRole("dialog", { name: "Takhreej" });
    expect(within(dialog).getByText("صحيح مسلم")).toBeTruthy();
    expect(within(dialog).queryByText("جامع البيان")).toBeNull();
  });

  it("drops the wash and the buttons when the reader has turned takhreej off", () => {
    const { container } = render(<BismillahBlock arabic="بِسْمِ" segments={SEGMENTS} showTakhreej={false} />);
    expect(screen.queryByRole("button", { name: "Show takhreej" })).toBeNull();
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).toContain("پہلا اقتباس");
  });
});
