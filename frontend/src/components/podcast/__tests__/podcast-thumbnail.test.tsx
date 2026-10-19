import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import PodcastThumbnail, { parseThumbnailTitle, plainThumbnailTitle } from "../podcast-thumbnail";

afterEach(cleanup);

describe("parseThumbnailTitle", () => {
  it("splits the title at its asterisks, highlighting the runs between a pair", () => {
    expect(parseThumbnailTitle("Kya Quran mein *Naskh* hai?")).toEqual([
      { text: "Kya Quran mein ", highlighted: false },
      { text: "Naskh", highlighted: true },
      { text: " hai?", highlighted: false },
    ]);
  });

  it("highlights two words apart, and a mark at either end", () => {
    expect(parseThumbnailTitle("*Jumla-e-mustanifa* kya hai?")).toEqual([
      { text: "Jumla-e-mustanifa", highlighted: true },
      { text: " kya hai?", highlighted: false },
    ]);
    expect(parseThumbnailTitle("Kya *Hazf* aur *Naskh*")).toEqual([
      { text: "Kya ", highlighted: false },
      { text: "Hazf", highlighted: true },
      { text: " aur ", highlighted: false },
      { text: "Naskh", highlighted: true },
    ]);
  });

  it("shows a title without marks, or with an unpaired asterisk, as written", () => {
    expect(parseThumbnailTitle("Naskh")).toEqual([{ text: "Naskh", highlighted: false }]);
    expect(parseThumbnailTitle("Naskh *hai")).toEqual([{ text: "Naskh *hai", highlighted: false }]);
    expect(plainThumbnailTitle("Kya Quran mein *Naskh* hai?")).toBe("Kya Quran mein Naskh hai?");
  });
});

describe("PodcastThumbnail", () => {
  it("shows the art and the title with its marked word highlighted", () => {
    const { container } = render(
      <PodcastThumbnail title="Kya Quran mein *Naskh* hai?" imageUrl="https://audio.example/podcasts/naskh.thumbnail.v1.webp" align="right" />,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.getAttribute("src")).toBe("https://audio.example/podcasts/naskh.thumbnail.v1.webp");
    expect(img.getAttribute("alt")).toBe("");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(screen.getByText("Naskh").closest("mark")).not.toBeNull();
    const card = container.firstElementChild as HTMLElement;
    expect(card.textContent).toBe("Kya Quran mein Naskh hai?");
    expect(card.dataset.align).toBe("right");
    // Spans only, so the card can sit inside a button
    expect(card.querySelectorAll("div, p")).toHaveLength(0);
  });

  it("takes the right side by default, and the class the consumer gives it", () => {
    const { container } = render(<PodcastThumbnail title="Hazf" imageUrl="/hazf.png" className="mine" />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.dataset.align).toBe("right");
    expect(card.classList.contains("mine")).toBe(true);
    expect(container.querySelector("mark")).toBeNull();
    expect(screen.queryByText(/^\d+:\d\d$/)).toBeNull();
  });

  it("keeps each word of a marked term whole, breaking only at its spaces", () => {
    render(<PodcastThumbnail title="Kya Quran mein *istisna munqati* hai?" imageUrl="/x.png" />);
    const mark = screen.getByText((_, el) => el?.tagName === "MARK" && el.textContent === "istisna munqati");
    expect([...mark.children].map((w) => w.textContent)).toEqual(["istisna", " munqati"]);
  });

  it("shows the recording's length when given one", () => {
    render(<PodcastThumbnail title="Hazf" imageUrl="/hazf.png" duration="19:48" />);
    expect(screen.getByText("19:48")).toBeTruthy();
  });
});
