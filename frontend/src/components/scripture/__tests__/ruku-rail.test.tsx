import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SuraListItem from "@/components/scripture/sura-list-item";
import JuzListItem from "@/components/scripture/juz-list-item";
import type { TranslationLang } from "@/components/scripture/ayah-block";

function renderSura(
  number: number,
  name: string,
  lang: TranslationLang = "urdu",
  showRukuRail = true,
) {
  render(
    <SuraListItem
      number={number}
      name={name}
      arabicName=""
      revelationType="Madani"
      verseCount={0}
      lang={lang}
      showRukuRail={showRukuRail}
    />,
  );
}

function renderJuz(juzNumber: number, showRukuRail = true) {
  render(
    <JuzListItem
      juzNumber={juzNumber}
      arabicName=""
      transliteratedName="Alif Lam Meem"
      startChapter={1}
      startVerse={1}
      endChapter={2}
      endVerse={141}
      lang="urdu"
      showRukuRail={showRukuRail}
    />,
  );
}

// The static export adds the trailing slash; jsdom renders Link without next.config.
const hrefOf = (link: HTMLElement) => link.getAttribute("href")?.replace(/\/$/, "");

function rukuLinks(label: string) {
  return within(screen.getByRole("list", { name: label })).getAllByRole("link");
}

describe("Ruku rails in the Quran index", () => {
  afterEach(cleanup);

  it("lists every ruku of a chapter, each linking to its ruku page", () => {
    renderSura(2, "al-Baqarah");
    const links = rukuLinks("Rukus of al-Baqarah");
    expect(links).toHaveLength(40);
    expect(hrefOf(links[0])).toBe("/quran/2/ruku/1");
    expect(hrefOf(links[39])).toBe("/quran/2/ruku/40");
    expect(links[0].getAttribute("aria-label")).toBe("Ruku 1, 7 verses");
  });

  it("marks where a chapter crosses into the next juz", () => {
    renderSura(2, "al-Baqarah");
    const breaks = rukuLinks("Rukus of al-Baqarah")
      .map((link, i) => (link.parentElement!.className.includes("startsNew") ? i + 1 : null))
      .filter((rank) => rank != null);
    // al-Baqarah runs through juz 1, 2 and 3, so its rail breaks twice.
    expect(breaks).toHaveLength(2);
  });

  it("shows no rail for a chapter with a single ruku", () => {
    renderSura(1, "al-Fātiḥah");
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("links a juz's rukus by their rank in the juz and names their chapter", () => {
    renderJuz(1);
    const links = rukuLinks("Rukus of juz 1");
    expect(hrefOf(links[0])).toBe("/quran/juz/1/ruku/0");
    expect(links[0].getAttribute("aria-label")).toBe("al-Fātiḥah, ruku 1, 7 verses");
    expect(hrefOf(links[1])).toBe("/quran/juz/1/ruku/1");
    expect(links[1].getAttribute("aria-label")).toBe("al-Baqarah, ruku 1, 7 verses");
  });

  it("hides a chapter's rail when the reader turns it off", () => {
    renderSura(2, "al-Baqarah", "urdu", false);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("hides a juz's rail when the reader turns it off", () => {
    renderJuz(1, false);
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it.each([
    ["urdu", "۴۰"],
    ["hindi", "४०"],
    ["english", "40"],
  ] as const)("writes the ruku numbers in %s digits", (lang, forty) => {
    renderSura(2, "al-Baqarah", lang);
    const last = rukuLinks("Rukus of al-Baqarah")[39];
    expect(last.textContent).toContain(forty);
  });
});
