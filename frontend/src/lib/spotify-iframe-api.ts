/**
 * Spotify's iFrame API (https://developer.spotify.com/documentation/embeds/references/iframe-api):
 * one script that, once loaded, calls `window.onSpotifyIframeApiReady` with an object whose
 * `createController` swaps a DOM element for the Spotify embed and hands back a controller for
 * it. The script is fetched here only when a reader first plays something, never on page load.
 */

export const SPOTIFY_IFRAME_API_SRC = "https://open.spotify.com/embed/iframe-api/v1";

const LOAD_TIMEOUT_MS = 10_000;

export interface PlaybackUpdate {
  playingURI: string;
  isPaused: boolean;
  isBuffering: boolean;
  /** Milliseconds. */
  duration: number;
  /** Milliseconds. */
  position: number;
}

export interface EmbedController {
  /** Loads a `spotify:<kind>:<id>` URI into the embed. */
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  resume(): void;
  togglePlay(): void;
  /** Seconds. */
  seek(seconds: number): void;
  /** Removes the embed and its element from the page. */
  destroy(): void;
  addListener(event: "ready", handler: () => void): void;
  addListener(event: "playback_update", handler: (e: { data: PlaybackUpdate }) => void): void;
  addListener(event: "playback_started", handler: (e: { data: { playingURI: string } }) => void): void;
}

export interface EmbedOptions {
  uri?: string;
  url?: string;
  width?: string | number;
  height?: string | number;
}

export interface IFrameAPI {
  /** Replaces `element` with the embed; `callback` receives its controller. */
  createController(
    element: HTMLElement,
    options: EmbedOptions,
    callback: (controller: EmbedController) => void,
  ): void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: IFrameAPI) => void;
  }
}

let pending: Promise<IFrameAPI> | null = null;

/**
 * Resolves with Spotify's API, adding its script on the first call. A failed or timed-out load
 * is not remembered, so the next play tries again.
 */
export function loadSpotifyIframeApi(): Promise<IFrameAPI> {
  if (pending) return pending;
  pending = new Promise<IFrameAPI>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SPOTIFY_IFRAME_API_SRC;
    script.async = true;

    const timer = setTimeout(() => fail(new Error("Spotify script timed out")), LOAD_TIMEOUT_MS);

    const settle = () => {
      clearTimeout(timer);
      delete window.onSpotifyIframeApiReady;
    };
    const fail = (error: Error) => {
      settle();
      script.remove();
      pending = null;
      reject(error);
    };

    window.onSpotifyIframeApiReady = (api) => {
      settle();
      resolve(api);
    };
    script.addEventListener("error", () => fail(new Error("Spotify script failed to load")));
    document.head.appendChild(script);
  });
  return pending;
}

/** Test-only: forgets the loaded or pending API so the next call injects the script again. */
export function resetSpotifyIframeApiForTests(): void {
  pending = null;
  delete window.onSpotifyIframeApiReady;
}
