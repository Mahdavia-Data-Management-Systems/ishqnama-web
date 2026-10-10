import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PlayableLink from "@/components/audio/playable-link";

const play = vi.fn();
let current = false;
let isPaused: boolean | undefined;
vi.mock("@/context/audio-player-context", () => ({
  useAudioPlayer: () => ({
    play,
    isCurrent: () => current,
    playback: isPaused === undefined ? null : { isPaused, isBuffering: false, duration: 0, position: 0 },
  }),
}));

const link = "https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5";

describe("PlayableLink", () => {
  beforeEach(() => {
    play.mockReset();
    current = false;
    isPaused = undefined;
  });
  afterEach(cleanup);

  it("is a button that reads as its text and starts the recording it names", () => {
    render(
      <PlayableLink link={link} title="Dua for completing the Quran" subtitle="Noor e Imaan">
        Listen to the dua
      </PlayableLink>,
    );
    const button = screen.getByRole("button", { name: "Listen to the dua" });
    fireEvent.click(button);
    expect(play).toHaveBeenCalledWith({ link, title: "Dua for completing the Quran", subtitle: "Noor e Imaan" });
  });

  it("is not pressed while another recording, or nothing, is playing", () => {
    render(<PlayableLink link={link} title="Dua">Listen</PlayableLink>);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
  });

  it("is pressed while it is the recording playing, and not once that pauses", () => {
    current = true;
    isPaused = false;
    const { rerender } = render(<PlayableLink link={link} title="Dua">Listen</PlayableLink>);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");

    isPaused = true;
    rerender(<PlayableLink link={link} title="Dua">Listen</PlayableLink>);
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
  });

  it("passes a class through for the page's own styling", () => {
    render(<PlayableLink link={link} title="Dua" className="mine">Listen</PlayableLink>);
    expect(screen.getByRole("button").classList.contains("mine")).toBe(true);
  });
});
