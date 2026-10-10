import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SPOTIFY_IFRAME_API_SRC,
  loadSpotifyIframeApi,
  resetSpotifyIframeApiForTests,
  type IFrameAPI,
} from "@/lib/spotify-iframe-api";

const fakeApi = { createController: vi.fn() } as unknown as IFrameAPI;

const scripts = () =>
  Array.from(document.querySelectorAll("script")).filter((s) => s.src === SPOTIFY_IFRAME_API_SRC);

/** The real script calls this global once it has loaded. */
function spotifyScriptLoads() {
  window.onSpotifyIframeApiReady?.(fakeApi);
}

describe("loadSpotifyIframeApi", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSpotifyIframeApiForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
    for (const s of scripts()) s.remove();
  });

  it("adds Spotify's script once and resolves when the script announces itself", async () => {
    const first = loadSpotifyIframeApi();
    const second = loadSpotifyIframeApi();
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0].async).toBe(true);

    spotifyScriptLoads();
    await expect(first).resolves.toBe(fakeApi);
    await expect(second).resolves.toBe(fakeApi);
  });

  it("hands the same api to callers who come after it has loaded", async () => {
    const first = loadSpotifyIframeApi();
    spotifyScriptLoads();
    await first;
    await expect(loadSpotifyIframeApi()).resolves.toBe(fakeApi);
    expect(scripts()).toHaveLength(1);
  });

  it("rejects when the script fails to load, and tries afresh next time", async () => {
    const attempt = loadSpotifyIframeApi();
    const dead = scripts()[0];
    dead.dispatchEvent(new Event("error"));
    await expect(attempt).rejects.toThrow(/script/i);

    const again = loadSpotifyIframeApi();
    // The dead script is taken out and a fresh one added.
    expect(scripts()).toHaveLength(1);
    expect(scripts()[0]).not.toBe(dead);
    spotifyScriptLoads();
    await expect(again).resolves.toBe(fakeApi);
  });

  it("rejects when the script says nothing for ten seconds", async () => {
    const attempt = loadSpotifyIframeApi();
    const outcome = attempt.then(
      () => "resolved",
      (e: Error) => e.message,
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(outcome).resolves.toMatch(/timed out/i);
  });
});
