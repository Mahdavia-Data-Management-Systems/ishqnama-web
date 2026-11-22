import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SearchResultCard from "@/components/search-result-card";
import styles from "@/components/search-result-card.module.css";
import type { SearchResultDto } from "@/types/api";

afterEach(cleanup);

const RESULT: SearchResultDto = {
  chapterNumber: 2,
  chapterName: "Al-Baqarah",
  verseNumber: 146,
  arabicText: "ٱلَّذِينَ",
  translationText: "جن کو ہم نے کتاب دی",
  explanation:
    'شرح کا متن <mark>اقتباس کا متن<ins data-takhreej="1"></ins></mark> اور ' +
    "<mark>پرانا اقتباس<ins>جامع البيان، ابن جرير الطبري ٣١٠ه — ٥/١٣١‍\n</ins></mark> باقی متن",
};

function renderCard(query: string) {
  return render(<SearchResultCard result={RESULT} query={query} lang="urdu" searchScope="both" />);
}

describe("SearchResultCard takhreej", () => {
  it("shows a cited passage as plain prose inside the link", () => {
    const { container } = renderCard("متن");
    const link = screen.getByRole("link");
    expect(link.querySelector("button")).toBeNull();
    expect(link.querySelector("ins")).toBeNull();
    expect(link.textContent).toContain("اقتباس کا متن");
    expect(link.textContent).toContain("پرانا اقتباس");
    expect(link.textContent).not.toContain("جامع البيان");

    // The only marks are the search's own.
    const marks = [...container.querySelectorAll("mark")];
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((m) => m.className === styles.highlight && m.textContent === "متن")).toBe(true);
  });

  it("highlights search text inside what was a cited passage", () => {
    const { container } = renderCard("اقتباس");
    const marks = [...container.querySelectorAll("mark")];
    expect(marks.map((m) => m.textContent)).toEqual(["اقتباس", "اقتباس"]);
    expect(marks.every((m) => m.className === styles.highlight)).toBe(true);
  });

  it("does not find a book's name, which is no longer part of the text", () => {
    const { container } = renderCard("الطبري");
    expect(container.querySelector("mark")).toBeNull();
    expect(container.textContent).not.toContain("الطبري");
  });
});
