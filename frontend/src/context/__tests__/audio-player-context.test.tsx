import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const trackEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  routePattern: (p: string) => p.replace(/\/\d+(?=\/|$)/g, "/[n]"),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/quran/2/" }));

import AudioPlayerProvider, { useAudioPlayer, type AudioPlayerContextValue } from "@/context/audio-player-context";
import type { Playlist } from "@/lib/recitation-playlist";

/** Stands in for the browser's Audio: records calls, lets a test set the time and fire events. */
class FakeAudio extends EventTarget {
  static instances: FakeAudio[] = [];
  src = "";
  preload = "";
  currentTime = 0;
  paused = true;
  calls: string[] = [];
  playResult: Promise<void> = Promise.resolve();
  constructor() {
    super();
    FakeAudio.instances.push(this);
  }
  load() { this.calls.push("load"); }
  play() {
    this.calls.push("play");
    this.paused = false;
    return this.playResult.then(() => { this.dispatchEvent(new Event("playing")); });
  }
  pause() { this.calls.push("pause"); this.paused = true; this.dispatchEvent(new Event("pause")); }
  removeAttribute(name: string) { if (name === "src") this.src = ""; }
  /** The browser has the file's metadata; a seek set before this is applied now. */
  ready() { this.dispatchEvent(new Event("loadedmetadata")); }
  at(seconds: number) { this.currentTime = seconds; this.dispatchEvent(new Event("timeupdate")); }
}

const file1 = "https://audio.test/001.mp3";
const file2 = "https://audio.test/002.mp3";
const playlist: Playlist = {
  id: "juz/1",
  href: "/quran/juz/1/",
  clips: [
    { url: file1, fromMs: 4000, toMs: 9000, title: "al-Fātiḥah", subtitle: "Verse 1", ref: { chapter: 1, verse: 1 } },
    { url: file1, fromMs: 9000, toMs: 14000, title: "al-Fātiḥah", subtitle: "Verse 2", ref: { chapter: 1, verse: 2 } },
    { url: file1, fromMs: 0, toMs: 4000, title: "al-Baqarah", subtitle: "Bismillah", ref: { chapter: 2, verse: 0 } },
    { url: file2, fromMs: 0, toMs: 6000, title: "al-Baqarah", subtitle: "Verse 1", ref: { chapter: 2, verse: 1 } },
    { url: file2, fromMs: 6200, toMs: 12000, title: "al-Baqarah", subtitle: "Verse 2", ref: { chapter: 2, verse: 2 } },
  ],
};
const wholeFile: Playlist = {
  id: "essay/1",
  clips: [{ url: "https://audio.test/essay.mp3", title: "An essay" }],
};

let api!: AudioPlayerContextValue;
function Probe() {
  api = useAudioPlayer();
  return <span data-testid="status">{api.status}:{api.index ?? "-"}</span>;
}
function Page({ children }: { children?: ReactNode }) {
  return <AudioPlayerProvider>{children}<Probe /></AudioPlayerProvider>;
}
const audio = () => FakeAudio.instances[FakeAudio.instances.length - 1];
const status = () => screen.getByTestId("status").textContent;
async function flush() { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); }

beforeEach(() => {
  FakeAudio.instances = [];
  vi.stubGlobal("Audio", FakeAudio);
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
  trackEvent.mockClear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("AudioPlayerProvider", () => {
  it("starts closed with no element created", () => {
    render(<Page />);
    expect(status()).toBe("closed:-");
    expect(FakeAudio.instances).toHaveLength(0);
  });

  it("creates one element on first play, loads the file at the clip's start and plays", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    expect(FakeAudio.instances).toHaveLength(1);
    expect(audio().src).toBe(`${file1}#t=4`);
    expect(audio().preload).toBe("auto");
    expect(audio().calls).toEqual(["load", "play"]);
    expect(status()).toBe("loading:0");
    await flush();
    expect(status()).toBe("playing:0");
    expect(api.current?.ref).toEqual({ chapter: 1, verse: 1 });
    expect(api.isCurrent({ chapter: 1, verse: 1 })).toBe(true);
    expect(api.isCurrent({ chapter: 1, verse: 2 })).toBe(false);
    expect(trackEvent).toHaveBeenCalledWith("recording-played", { route: "/quran/[n]/" });
  });

  it("corrects the position once metadata arrives if the fragment was not honoured", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    act(() => { audio().currentTime = 0; audio().ready(); });
    expect(audio().currentTime).toBe(4);
    act(() => { audio().currentTime = 4.1; audio().ready(); });
    expect(audio().currentTime).toBe(4.1);
  });

  it("runs on gapless into a clip that starts where this one ends", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    const seeks = audio().calls.length;
    act(() => audio().at(9.0));
    expect(status()).toBe("playing:1");
    expect(audio().calls).toHaveLength(seeks);
    expect(audio().currentTime).toBe(9.0);
  });

  it("seeks when the next clip in the same file starts elsewhere", async () => {
    render(<Page />);
    act(() => api.play(playlist, 1));
    await flush();
    act(() => audio().at(14.0));      // clip 2 is the basmala at 0-4 s of the same file
    expect(status()).toBe("playing:2");
    expect(audio().currentTime).toBe(0);
    expect(audio().src).toBe(`${file1}#t=9`);   // no reload for a seek
  });

  it("seeks when the next clip starts well before this one ended (an overlap in the export)", async () => {
    const overlapping: Playlist = {
      id: "quran/19",
      clips: [
        { url: file1, fromMs: 0, toMs: 13270, title: "Maryam", ref: { chapter: 19, verse: 1 } },
        { url: file1, fromMs: 634, toMs: 19201, title: "Maryam", ref: { chapter: 19, verse: 2 } },
      ],
    };
    render(<Page />);
    act(() => api.play(overlapping, 0));
    await flush();
    act(() => audio().at(13.27));
    expect(status()).toBe("playing:1");
    expect(audio().currentTime).toBeCloseTo(0.634, 3);
  });

  it("tolerates a small gap at the boundary without nudging the audio", async () => {
    render(<Page />);
    act(() => api.play(playlist, 3));
    await flush();
    act(() => audio().at(6.0));       // clip 4 starts at 6.2 s: within tolerance
    expect(status()).toBe("playing:4");
    expect(audio().currentTime).toBe(6.0);
  });

  it("switches file for a clip in another file", async () => {
    render(<Page />);
    act(() => api.play(playlist, 2));
    await flush();
    act(() => audio().at(4.0));
    expect(status()).toBe("loading:3");
    expect(audio().src).toBe(`${file2}#t=0`);
    expect(audio().calls.slice(-2)).toEqual(["load", "play"]);
    await flush();
    expect(status()).toBe("playing:3");
  });

  it("closes after the last clip", async () => {
    render(<Page />);
    act(() => api.play(playlist, 4));
    await flush();
    act(() => audio().at(12.0));
    expect(status()).toBe("closed:-");
    expect(audio().calls.at(-1)).toBe("pause");
    expect(audio().src).toBe("");
    expect(api.isCurrent({ chapter: 2, verse: 2 })).toBe(false);
  });

  it("plays a whole-file clip and closes on ended", async () => {
    render(<Page />);
    act(() => api.play(wholeFile, 0));
    expect(audio().src).toBe("https://audio.test/essay.mp3");
    await flush();
    act(() => audio().at(5000));
    expect(status()).toBe("playing:0");
    act(() => audio().dispatchEvent(new Event("ended")));
    expect(status()).toBe("closed:-");
  });

  it("pauses and resumes by replaying the current clip, and through pause/resume", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    act(() => api.play(playlist, 0));
    expect(status()).toBe("paused:0");
    expect(audio().calls.at(-1)).toBe("pause");
    act(() => api.play(playlist, 0));
    await flush();
    expect(status()).toBe("playing:0");
    act(() => api.pause());
    expect(status()).toBe("paused:0");
    act(() => api.resume());
    await flush();
    expect(status()).toBe("playing:0");
  });

  it("treats a rebuilt playlist with the same id as the same playlist", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    act(() => api.play({ ...playlist, clips: [...playlist.clips] }, 0));
    expect(status()).toBe("paused:0");
  });

  it("moves with next and previous and stays put at the ends", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    act(() => api.previous());
    expect(status()).toBe("playing:0");
    act(() => api.next());
    expect(status()).toBe("playing:1");
    expect(audio().currentTime).toBe(9);
    act(() => api.next());                 // 2: the basmala, same file, a seek to 0
    expect(audio().currentTime).toBe(0);
    act(() => api.next());                 // 3: a new file
    expect(status()).toBe("loading:3");
    await flush();
    expect(status()).toBe("playing:3");
    act(() => api.next());                 // 4: same file, a seek to 6.2
    expect(status()).toBe("playing:4");
    expect(audio().currentTime).toBe(6.2);
    act(() => api.next());                 // past the end: nothing happens
    expect(status()).toBe("playing:4");
  });

  it("fails on an audio error, keeps its place, and tries again on resume", async () => {
    render(<Page />);
    act(() => api.play(playlist, 3));
    await flush();
    act(() => audio().dispatchEvent(new Event("error")));
    expect(status()).toBe("failed:3");
    expect(trackEvent).toHaveBeenCalledWith("recording-failed", { reason: "audio" });
    act(() => api.resume());
    expect(audio().calls.slice(-2)).toEqual(["load", "play"]);
    await flush();
    expect(status()).toBe("playing:3");
  });

  it("reports a refused play as blocked and ignores an aborted one", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    const err = Object.assign(new Error("gesture"), { name: "NotAllowedError" });
    audio().playResult = Promise.reject(err);
    act(() => api.resume());
    await flush();
    expect(status()).toBe("failed:0");
    expect(trackEvent).toHaveBeenCalledWith("recording-failed", { reason: "blocked" });

    audio().playResult = Promise.reject(Object.assign(new Error("superseded"), { name: "AbortError" }));
    act(() => api.resume());
    await flush();
    expect(status()).toBe("loading:0");
  });

  it("pauses when the browser goes offline", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    await flush();
    act(() => window.dispatchEvent(new Event("offline")));
    expect(status()).toBe("paused:0");
  });

  it("close stops the audio, forgets the playlist and returns focus to the trigger", async () => {
    render(
      <Page>
        <button type="button">Play</button>
      </Page>,
    );
    const trigger = screen.getByRole("button", { name: "Play" });
    act(() => api.play(playlist, 0, trigger));
    await flush();
    act(() => api.close());
    expect(status()).toBe("closed:-");
    expect(api.playlist).toBeNull();
    expect(audio().calls.at(-1)).toBe("pause");
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps playing when the page that started it unmounts", async () => {
    function Starter() {
      const { play } = useAudioPlayer();
      return <button type="button" onClick={(e) => play(playlist, 0, e.currentTarget)}>Start</button>;
    }
    const { rerender } = render(<AudioPlayerProvider><Starter /><Probe /></AudioPlayerProvider>);
    act(() => screen.getByRole("button", { name: "Start" }).click());
    await flush();
    rerender(<AudioPlayerProvider><Probe /></AudioPlayerProvider>);
    expect(status()).toBe("playing:0");
    act(() => audio().at(9));
    expect(status()).toBe("playing:1");
    act(() => api.close());   // the trigger is gone; close must not throw
    expect(status()).toBe("closed:-");
  });

  it("sets data-audio-bar on <html> while open", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    expect(document.documentElement.hasAttribute("data-audio-bar")).toBe(true);
    act(() => api.close());
    expect(document.documentElement.hasAttribute("data-audio-bar")).toBe(false);
  });

  it("loads the other file when a new playlist's verse is not in the file playing", async () => {
    const file3 = "https://audio.test/003.mp3";
    const chapter = (n: number, url: string): Playlist => ({
      id: `quran/${n}`,
      clips: [0, 1, 2, 3, 4, 5].map((v) => ({ url, fromMs: v * 5000, toMs: v * 5000 + 5000, title: `Chapter ${n}`, ref: { chapter: n, verse: v } })),
    });
    render(<Page />);
    act(() => api.play(chapter(2, file2), 4));
    await flush();
    expect(status()).toBe("playing:4");
    act(() => api.play(chapter(3, file3), 0));
    expect(status()).toBe("loading:0");
    expect(audio().src).toBe(`${file3}#t=0`);
    expect(audio().calls.slice(-2)).toEqual(["load", "play"]);
  });

  it("returns focus to the trigger when the recitation ends while a bar control has focus", async () => {
    render(
      <Page>
        <button type="button">Play</button>
      </Page>,
    );
    const trigger = screen.getByRole("button", { name: "Play" });
    act(() => api.play(playlist, 4, trigger));
    await flush();
    act(() => screen.getByRole("button", { name: "Pause" }).focus());
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Pause");
    act(() => audio().at(12.0));
    expect(status()).toBe("closed:-");
    expect(document.activeElement).toBe(trigger);
  });

  it("leaves focus where it is when the recitation ends and the reader is elsewhere on the page", async () => {
    render(
      <Page>
        <button type="button">Play</button>
        <input aria-label="Search" />
      </Page>,
    );
    const trigger = screen.getByRole("button", { name: "Play" });
    act(() => api.play(playlist, 4, trigger));
    await flush();
    const field = screen.getByRole("textbox", { name: "Search" });
    act(() => field.focus());
    act(() => audio().at(12.0));
    expect(status()).toBe("closed:-");
    expect(document.activeElement).toBe(field);
  });

  it("never sends a title or url to telemetry", async () => {
    render(<Page />);
    act(() => api.play(playlist, 0));
    for (const call of trackEvent.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(/audio\.test|Fātiḥah/);
    }
  });
});
