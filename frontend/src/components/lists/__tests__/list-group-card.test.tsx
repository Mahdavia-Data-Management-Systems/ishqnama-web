import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ListGroupCard from "@/components/lists/list-group-card";

vi.mock("@/hooks/use-arabic-verses", () => ({ useArabicVerses: () => ({ verses: [], failed: false }) }));
vi.mock("@/lib/api-readiness", () => ({ useApiReadiness: () => "ready" }));
vi.mock("@/context/reader-settings-context", () => ({ useReaderSettings: () => ({ lang: "english", fontScale: 2 }) }));
vi.mock("@/context/audio-player-context", () => ({ useAudioPlayer: () => ({ isCurrent: () => false }) }));

afterEach(cleanup);

describe("ListGroupCard play control", () => {
  it("offers Play from here on the caption line and hands over the button", () => {
    const onPlay = vi.fn();
    render(<ListGroupCard group={{ id: "g1", chapter: 2, fromVerse: 1, toVerse: 5, caption: "Opening" }} onPlay={onPlay} />);
    const button = screen.getByRole("button", { name: "Play from here" });
    fireEvent.click(button);
    expect(onPlay).toHaveBeenCalledWith(button);
  });

  it("shows no play control when the page gives none", () => {
    render(<ListGroupCard group={{ id: "g1", chapter: 2, fromVerse: 1, toVerse: 5, caption: null }} />);
    expect(screen.queryByRole("button", { name: "Play from here" })).toBeNull();
  });
});
