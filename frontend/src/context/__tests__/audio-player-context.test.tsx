import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AudioPlayerProvider, { useAudioPlayer } from "@/context/audio-player-context";
import type { EmbedController, IFrameAPI, PlaybackUpdate } from "@/lib/spotify-iframe-api";

let pathname = "/quran/2/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

const trackEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  trackEvent: (...args: unknown[]) => trackEvent(...args),
  routePattern: (p: string) => p.replace(/\/\d+(?=\/|$)/g, "/[n]"),
}));

const loadSpotifyIframeApi = vi.fn<() => Promise<IFrameAPI>>();
vi.mock("@/lib/spotify-iframe-api", () => ({
  loadSpotifyIframeApi: () => loadSpotifyIframeApi(),
}));

/** A stand-in for Spotify's controller that records calls and lets the test fire its events. */
function fakeController() {
  const listeners = new Map<string, (e: unknown) => void>();
  const controller = {
    loadUri: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    togglePlay: vi.fn(),
    seek: vi.fn(),
    destroy: vi.fn(),
    addListener: vi.fn((event: string, handler: (e: unknown) => void) => {
      listeners.set(event, handler);
    }),
  };
  const emit = (event: string, data?: unknown) => {
    act(() => listeners.get(event)?.({ data }));
  };
  return { controller: controller as unknown as EmbedController, calls: controller, emit };
}

function fakeApi() {
  const made = fakeController();
  const createController = vi.fn(
    (element: HTMLElement, options: unknown, callback: (c: EmbedController) => void) => {
      // Spotify swaps the element for its iframe.
      const iframe = document.createElement("iframe");
      iframe.dataset.uri = (options as { uri: string }).uri;
      element.replaceWith(iframe);
      callback(made.controller);
    },
  );
  const api = { createController } as unknown as IFrameAPI;
  return { api, createController, ...made };
}

const FIRST = "https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5?si=abc";
const SECOND = "spotify:episode:1x2y3z4a5b6c7d8e9f0g1h";

function Harness() {
  const player = useAudioPlayer();
  return (
    <>
      <button onClick={() => player.play({ link: FIRST, title: "The first recording" })}>play first</button>
      <button onClick={() => player.play({ link: SECOND, title: "The second recording", subtitle: "Al-Baqarah" })}>
        play second
      </button>
      <button onClick={() => player.play({ link: "https://example.com/not-spotify", title: "Elsewhere" })}>
        play elsewhere
      </button>
      <button onClick={player.togglePlay}>toggle</button>
      <output data-testid="status">{player.status}</output>
      <output data-testid="paused">{String(player.playback?.isPaused)}</output>
      <output data-testid="first-current">{String(player.isCurrent(FIRST))}</output>
    </>
  );
}

const status = () => screen.getByTestId("status").textContent;
const dock = () => screen.queryByRole("region", { name: "Recording" });

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("AudioPlayerProvider", () => {
  beforeEach(() => {
    pathname = "/quran/2/";
    trackEvent.mockReset();
    loadSpotifyIframeApi.mockReset();
  });
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute("data-audio-dock");
  });

  function renderPlayer() {
    return render(
      <AudioPlayerProvider>
        <Harness />
      </AudioPlayerProvider>,
    );
  }

  it("shows no dock and fetches nothing until a reader plays something", () => {
    renderPlayer();
    expect(status()).toBe("closed");
    expect(dock()).toBeNull();
    expect(loadSpotifyIframeApi).not.toHaveBeenCalled();
    expect(document.documentElement.hasAttribute("data-audio-dock")).toBe(false);
  });

  it("opens the dock, builds the embed for the link and starts it once ready", async () => {
    const spotify = fakeApi();
    loadSpotifyIframeApi.mockResolvedValue(spotify.api);
    renderPlayer();

    fireEvent.click(screen.getByText("play first"));
    expect(status()).toBe("starting");
    expect(dock()).not.toBeNull();
    expect(screen.getByText("The first recording")).toBeTruthy();
    expect(document.documentElement.hasAttribute("data-audio-dock")).toBe(true);

    await settle();
    expect(spotify.createController).toHaveBeenCalledTimes(1);
    const [element, options] = spotify.createController.mock.calls[0];
    expect(options).toEqual({ uri: "spotify:episode:7makk4oTQel546B0PZlDM5", width: "100%", height: 80 });
    expect(dock()?.querySelector("iframe")).not.toBeNull();
    expect(element).toBeInstanceOf(HTMLElement);
    expect(spotify.calls.play).not.toHaveBeenCalled();

    spotify.emit("ready");
    expect(status()).toBe("ready");
    expect(spotify.calls.play).toHaveBeenCalledTimes(1);
  });

  it("loads a second recording into the same embed", async () => {
    const spotify = fakeApi();
    loadSpotifyIframeApi.mockResolvedValue(spotify.api);
    renderPlayer();
    fireEvent.click(screen.getByText("play first"));
    await settle();
    spotify.emit("ready");

    fireEvent.click(screen.getByText("play second"));
    expect(spotify.createController).toHaveBeenCalledTimes(1);
    expect(spotify.calls.loadUri).toHaveBeenCalledWith("spotify:episode:1x2y3z4a5b6c7d8e9f0g1h");
    expect(spotify.calls.play).toHaveBeenCalledTimes(2);
    expect(screen.getByText("The second recording")).toBeTruthy();
    expect(screen.getByText("Al-Baqarah")).toBeTruthy();
    expect(screen.getByTestId("first-current").textContent).toBe("false");
  });

  it("plays the recording chosen while the first was still starting", async () => {
    const spotify = fakeApi();
    let resolveApi: (api: IFrameAPI) => void = () => {};
    loadSpotifyIframeApi.mockReturnValue(new Promise((r) => (resolveApi = r)));
    renderPlayer();
    fireEvent.click(screen.getByText("play first"));
    fireEvent.click(screen.getByText("play second"));

    await act(async () => resolveApi(spotify.api));
    await settle();
    expect(spotify.createController).toHaveBeenCalledTimes(1);
    expect(spotify.createController.mock.calls[0][1]).toMatchObject({ uri: "spotify:episode:1x2y3z4a5b6c7d8e9f0g1h" });
    expect(spotify.calls.loadUri).not.toHaveBeenCalled();
  });

  it("pauses and resumes when the playing recording is chosen again", async () => {
    const spotify = fakeApi();
    loadSpotifyIframeApi.mockResolvedValue(spotify.api);
    renderPlayer();
    fireEvent.click(screen.getByText("play first"));
    await settle();
    spotify.emit("ready");

    fireEvent.click(screen.getByText("play first"));
    expect(spotify.calls.togglePlay).toHaveBeenCalledTimes(1);
    expect(spotify.calls.loadUri).not.toHaveBeenCalled();
    expect(spotify.calls.play).toHaveBeenCalledTimes(1);
  });

  it("follows the embed's own playback state", async () => {
    const spotify = fakeApi();
    loadSpotifyIframeApi.mockResolvedValue(spotify.api);
    renderPlayer();
    fireEvent.click(screen.getByText("play first"));
    await settle();
    spotify.emit("ready");
    expect(screen.getByTestId("paused").textContent).toBe("undefined");

    const update: PlaybackUpdate = {
      playingURI: "spotify:episode:7makk4oTQel546B0PZlDM5",
      isPaused: false,
      isBuffering: false,
      duration: 120_000,
      position: 5_000,
    };
    spotify.emit("playback_update", update);
    expect(screen.getByTestId("paused").textContent).toBe("false");
    spotify.emit("playback_update", { ...update, isPaused: true });
    expect(screen.getByTestId("paused").textContent).toBe("true");
  });

  it("closing removes the embed and the dock and hands focus back", async () => {
    const spotify = fakeApi();
    loadSpotifyIframeApi.mockResolvedValue(spotify.api);
    renderPlayer();
    const trigger = screen.getByText("play first");
    trigger.focus();
    fireEvent.click(trigger);
    await settle();
    spotify.emit("ready");

    fireEvent.click(screen.getByRole("button", { name: "Close recording" }));
    expect(spotify.calls.destroy).toHaveBeenCalledTimes(1);
    expect(status()).toBe("closed");
    expect(dock()).toBeNull();
    expect(document.documentElement.hasAttribute("data-audio-dock")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("hands focus back to the page, never to its own title, after a second recording", async () => {
    const spotify = fakeApi();
    loadSpotifyIframeApi.mockResolvedValue(spotify.api);
    renderPlayer();
    const trigger = screen.getByText("play first");
    trigger.focus();
    fireEvent.click(trigger);
    await settle();
    spotify.emit("ready");
    // The dock has taken focus; a second recording chosen now must not record the dock itself
    // as where focus should go back to.
    expect(dock()?.contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByText("play second"));

    fireEvent.click(screen.getByRole("button", { name: "Close recording" }));
    expect(document.activeElement).toBe(trigger);
  });

  it("starts a fresh embed after a close", async () => {
    const spotify = fakeApi();
    loadSpotifyIframeApi.mockResolvedValue(spotify.api);
    renderPlayer();
    fireEvent.click(screen.getByText("play first"));
    await settle();
    spotify.emit("ready");
    fireEvent.click(screen.getByRole("button", { name: "Close recording" }));

    fireEvent.click(screen.getByText("play second"));
    await settle();
    expect(spotify.createController).toHaveBeenCalledTimes(2);
    expect(spotify.createController.mock.calls[1][1]).toMatchObject({ uri: "spotify:episode:1x2y3z4a5b6c7d8e9f0g1h" });
  });

  it("says when Spotify cannot be reached, offers the link, and tries again next time", async () => {
    loadSpotifyIframeApi.mockRejectedValueOnce(new Error("Spotify script failed to load"));
    renderPlayer();
    fireEvent.click(screen.getByText("play first"));
    await settle();

    expect(status()).toBe("failed");
    expect(screen.getByText("This recording couldn't start.")).toBeTruthy();
    const out = screen.getByRole("link", { name: "Open it in Spotify" });
    expect(out.getAttribute("href")).toBe("https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5");
    expect(out.getAttribute("target")).toBe("_blank");
    expect(trackEvent).toHaveBeenCalledWith("recording-failed", { reason: "unavailable" });

    const spotify = fakeApi();
    loadSpotifyIframeApi.mockResolvedValue(spotify.api);
    fireEvent.click(screen.getByText("play first"));
    await settle();
    expect(loadSpotifyIframeApi).toHaveBeenCalledTimes(2);
    expect(spotify.createController).toHaveBeenCalledTimes(1);
    expect(status()).toBe("starting");
  });

  it("refuses a link that is not Spotify's without fetching anything", () => {
    renderPlayer();
    fireEvent.click(screen.getByText("play elsewhere"));
    expect(status()).toBe("failed");
    expect(loadSpotifyIframeApi).not.toHaveBeenCalled();
    expect(screen.getByText("This recording couldn't start.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Open it in Spotify" })).toBeNull();
    expect(trackEvent).toHaveBeenCalledWith("recording-failed", { reason: "invalid-link" });
  });

  it("drops the embed on a bad link and starts afresh for the next good one", async () => {
    const spotify = fakeApi();
    loadSpotifyIframeApi.mockResolvedValue(spotify.api);
    renderPlayer();
    fireEvent.click(screen.getByText("play first"));
    await settle();
    spotify.emit("ready");

    fireEvent.click(screen.getByText("play elsewhere"));
    expect(status()).toBe("failed");
    expect(spotify.calls.destroy).toHaveBeenCalledTimes(1);
    expect(dock()?.querySelector("iframe")).toBeNull();

    fireEvent.click(screen.getByText("play second"));
    await settle();
    expect(spotify.calls.loadUri).not.toHaveBeenCalled();
    expect(spotify.createController).toHaveBeenCalledTimes(2);
    expect(dock()?.querySelector("iframe")).not.toBeNull();
  });

  it("records what kind of thing was played and on which route, never the link", async () => {
    const spotify = fakeApi();
    loadSpotifyIframeApi.mockResolvedValue(spotify.api);
    renderPlayer();
    fireEvent.click(screen.getByText("play first"));
    expect(trackEvent).toHaveBeenCalledWith("recording-played", { option: "episode", route: "/quran/[n]/" });
    for (const call of trackEvent.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(/7makk4oTQel546B0PZlDM5|open\.spotify/);
    }
  });
});
