import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AudioPlayerContextValue } from "@/context/audio-player-context";

// next.config sets trailingSlash; Link reads this flag when it loads, so set it first.
vi.hoisted(() => {
  process.env.__NEXT_TRAILING_SLASH = "true";
});

let pathname = "/quran/2/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const player: AudioPlayerContextValue = {
  status: "playing",
  playlist: {
    id: "quran/2",
    href: "/quran/2/",
    clips: [
      { url: "u", fromMs: 0, toMs: 1, title: "al-Baqarah", subtitle: "Verse 254", ref: { chapter: 2, verse: 254 } },
      { url: "u", fromMs: 1, toMs: 2, title: "al-Baqarah", subtitle: "Verse 255", ref: { chapter: 2, verse: 255 } },
    ],
  },
  index: 1,
  current: null,
  play: vi.fn(), pause: vi.fn(), resume: vi.fn(), next: vi.fn(), previous: vi.fn(), close: vi.fn(),
  isCurrent: () => false,
};
player.current = player.playlist!.clips[1];
vi.mock("@/context/audio-player-context", () => ({ useAudioPlayer: () => player }));

import AudioPlayerBar from "@/components/audio/audio-player-bar";

afterEach(() => { cleanup(); Object.assign(player, { status: "playing", index: 1, current: player.playlist!.clips[1] }); pathname = "/quran/2/"; });

describe("AudioPlayerBar", () => {
  it("is a region named Recording with the verse as a link back to its page", () => {
    render(<AudioPlayerBar />);
    expect(screen.getByRole("region", { name: "Recording" })).toBeTruthy();
    const link = screen.getByRole("link", { name: /al-Baqarah.*Verse 255/ });
    expect(link.getAttribute("href")).toBe("/quran/2/?verse=255");
  });

  it("offers pause while playing and play while paused", () => {
    render(<AudioPlayerBar />);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(player.pause).toHaveBeenCalled();
    cleanup();
    player.status = "paused";
    render(<AudioPlayerBar />);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(player.resume).toHaveBeenCalled();
  });

  it("moves between verses and disables the end it is at", () => {
    render(<AudioPlayerBar />);
    fireEvent.click(screen.getByRole("button", { name: "Previous verse" }));
    expect(player.previous).toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Next verse" }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    player.index = 0;
    player.current = player.playlist!.clips[0];
    render(<AudioPlayerBar />);
    expect((screen.getByRole("button", { name: "Previous verse" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("closes", () => {
    render(<AudioPlayerBar />);
    fireEvent.click(screen.getByRole("button", { name: "Close recording" }));
    expect(player.close).toHaveBeenCalled();
  });

  it("explains a failure and offers Try again", () => {
    player.status = "failed";
    render(<AudioPlayerBar />);
    expect(screen.getByText("This recording couldn't start.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(player.resume).toHaveBeenCalled();
  });

  it("marks what it clears: the toolbar on reader routes, the bottom nav elsewhere", () => {
    render(<AudioPlayerBar />);
    expect(screen.getByRole("region").getAttribute("data-clears")).toBe("toolbar");
    cleanup();
    pathname = "/lists/view/";
    render(<AudioPlayerBar />);
    expect(screen.getByRole("region").getAttribute("data-clears")).toBe("bottom-nav");
  });

  it("does not take focus when it appears", () => {
    render(<AudioPlayerBar />);
    expect(screen.getByRole("region").contains(document.activeElement)).toBe(false);
  });
});
