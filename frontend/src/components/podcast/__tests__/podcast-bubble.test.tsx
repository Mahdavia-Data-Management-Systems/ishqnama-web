import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PODCAST_COPY } from "@/config/podcast-copy";
import type { PodcastTimeline } from "@/lib/podcast-timeline";
import { resetAppBarOffset } from "@/lib/app-bar-offset";
import PodcastBubble from "../podcast-bubble";

const timeline: PodcastTimeline = {
  version: 1,
  audio: "episode.m4a",
  durationMs: 10000,
  language: "ur",
  speakers: { hamza: { cluster: 1, medianPitchHz: 98, speechMs: 4000 }, zoya: { cluster: 0, medianPitchHz: 219, speechMs: 5000 } },
  turns: [
    { speaker: "zoya", fromMs: 200, toMs: 4000, expression: "thoughtful", text: "فرض کریں" },
    { speaker: "hamza", fromMs: 4500, toMs: 9000, expression: "speaking", text: "بالکل" },
  ],
};

beforeEach(() => {
  // jsdom has no media playback; the bubble only needs the calls to resolve.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  resetAppBarOffset();
  document.querySelector("[data-app-bar]")?.remove();
});

function seekTo(seconds: number) {
  const audio = document.querySelector("audio") as HTMLAudioElement;
  Object.defineProperty(audio, "currentTime", { value: seconds, configurable: true, writable: true });
  act(() => {
    fireEvent(audio, new Event("timeupdate"));
  });
}

describe("PodcastBubble", () => {
  it("seats the episode's mascots in cast order, listening, with the opening caption", () => {
    render(<PodcastBubble timeline={timeline} audioUrl="https://cdn.example/episode.m4a" onClose={() => {}} />);
    const portraits = screen.getAllByRole("img").filter((img) => img.getAttribute("src")?.includes("/mascots/"));
    expect(portraits.map((p) => p.getAttribute("alt"))).toEqual(["Hamza", "Zoya"]);
    expect(portraits.map((p) => p.getAttribute("src"))).toEqual(["/images/mascots/hamza/listening.webp", "/images/mascots/zoya/listening.webp"]);
    expect(screen.getByText(PODCAST_COPY.opening)).toBeTruthy();
    expect(screen.getByRole("region", { name: PODCAST_COPY.regionLabel })).toBeTruthy();
  });

  it("gives the speaker the turn's expression and words as the recording moves", () => {
    render(<PodcastBubble timeline={timeline} audioUrl="https://cdn.example/episode.m4a" onClose={() => {}} />);
    seekTo(1);
    expect(screen.getByRole("img", { name: "Zoya" }).getAttribute("src")).toBe("/images/mascots/zoya/thoughtful.webp");
    expect(screen.getByRole("img", { name: "Hamza" }).getAttribute("src")).toBe("/images/mascots/hamza/listening.webp");
    expect(screen.getByText("فرض کریں")).toBeTruthy();
    expect(screen.getByRole("region", { name: PODCAST_COPY.regionLabel }).getAttribute("data-speaker")).toBe("zoya");
    seekTo(5);
    expect(screen.getByRole("img", { name: "Hamza" }).getAttribute("src")).toBe("/images/mascots/hamza/speaking.webp");
    expect(screen.getByRole("region", { name: PODCAST_COPY.regionLabel }).getAttribute("data-speaker")).toBe("hamza");
  });

  it("plays and pauses from its one main control and closes on request", () => {
    const onClose = vi.fn();
    render(<PodcastBubble timeline={timeline} audioUrl="https://cdn.example/episode.m4a" onClose={onClose} />);
    const audio = document.querySelector("audio") as HTMLAudioElement;
    expect(audio.getAttribute("src")).toBe("https://cdn.example/episode.m4a");
    expect(audio.getAttribute("crossorigin")).toBe("anonymous");
    fireEvent.click(screen.getByRole("button", { name: PODCAST_COPY.resume }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    act(() => {
      fireEvent(audio, new Event("play"));
    });
    fireEvent.click(screen.getByRole("button", { name: PODCAST_COPY.pause }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: PODCAST_COPY.close }));
    expect(onClose).toHaveBeenCalled();
  });

  it("offers to try again when the recording fails", () => {
    render(<PodcastBubble timeline={timeline} audioUrl="https://cdn.example/episode.m4a" onClose={() => {}} />);
    act(() => {
      fireEvent(document.querySelector("audio") as HTMLAudioElement, new Event("error"));
    });
    expect(screen.getByText(PODCAST_COPY.couldNotStart)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: PODCAST_COPY.tryAgain }));
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("ends below the app bar while the bar is on screen", () => {
    const bar = document.createElement("header");
    bar.setAttribute("data-app-bar", "");
    bar.getBoundingClientRect = () => ({ bottom: 64, top: 0, left: 0, right: 0, width: 0, height: 64, x: 0, y: 0, toJSON: () => ({}) });
    document.body.appendChild(bar);
    render(<PodcastBubble timeline={timeline} audioUrl="https://cdn.example/episode.m4a" onClose={() => {}} />);
    const region = screen.getByRole("region", { name: PODCAST_COPY.regionLabel });
    expect(region.style.getPropertyValue("--clear-top")).toBe("64px");
  });

  it("carries the Ishqnama mark and name, and the topic's title and caption", () => {
    render(<PodcastBubble timeline={{ ...timeline, title: "جملہ مستأنفہ", caption: "The resumptive clause" }} audioUrl="https://cdn.example/episode.m4a" onClose={() => {}} />);
    expect(screen.getByRole("img", { name: "Ishqnama" })).toBeTruthy();
    expect(screen.getByText(PODCAST_COPY.brand)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "جملہ مستأنفہ" })).toBeTruthy();
    expect(screen.getByText("The resumptive clause")).toBeTruthy();
  });

  it("leaves the topic lines out when the timeline names none", () => {
    render(<PodcastBubble timeline={timeline} audioUrl="https://cdn.example/episode.m4a" onClose={() => {}} />);
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.getByText(PODCAST_COPY.brand)).toBeTruthy();
  });
});
