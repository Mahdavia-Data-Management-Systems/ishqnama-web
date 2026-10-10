"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import AudioPlayerDock from "@/components/audio/audio-player-dock";
import { parseSpotifyLink, type SpotifyLink } from "@/lib/spotify-link";
import { loadSpotifyIframeApi, type EmbedController, type PlaybackUpdate } from "@/lib/spotify-iframe-api";
import { routePattern, trackEvent } from "@/lib/telemetry";

/** Something a reader can listen to: a Spotify link and the words the dock shows for it. */
export interface Recording {
  /** Any Spotify link or URI; see parseSpotifyLink. */
  link: string;
  /** What the reader sees in the dock, e.g. "Dua for completing the Quran". */
  title: string;
  /** An optional second line, e.g. the chapter name. */
  subtitle?: string;
}

export type AudioPlayerStatus = "closed" | "starting" | "ready" | "failed";

export interface Playback {
  isPaused: boolean;
  isBuffering: boolean;
  /** Milliseconds. */
  duration: number;
  /** Milliseconds. */
  position: number;
}

interface AudioPlayerContextValue {
  status: AudioPlayerStatus;
  /** What the dock shows; null while closed. */
  recording: Recording | null;
  /** The embed's last reported state; null until it reports. */
  playback: Playback | null;
  /** Opens the dock if needed and plays. The playing recording again: pauses or resumes it. */
  play: (recording: Recording) => void;
  togglePlay: () => void;
  /** Stops the audio, removes the embed and hides the dock. */
  close: () => void;
  /** Whether this link is the recording in the dock. */
  isCurrent: (link: string) => boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

/** Spotify's compact embed: cover, title, play and progress on one 80 px row. */
const EMBED_HEIGHT = 80;

/**
 * Owns the one Spotify embed for the whole site and the dock it sits in. Mounted in AppShell
 * around everything else, so the embed survives navigation and audio keeps playing while the
 * reader moves between pages. Spotify's script is fetched on the first play, never before.
 */
export default function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<AudioPlayerStatus>("closed");
  const [recording, setRecording] = useState<Recording | null>(null);
  const [parsed, setParsed] = useState<SpotifyLink | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);

  const hostRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLElement>(null);
  const controllerRef = useRef<EmbedController | null>(null);
  // The uri the dock should be playing, read when the embed is finally created or becomes ready,
  // so a recording chosen while the first was still starting is the one that plays.
  const wantedUriRef = useRef<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Build the embed once Spotify's script is here. The effect runs after the dock has rendered
  // its host element, so there is something for Spotify to replace.
  useEffect(() => {
    if (status !== "starting") return;
    let cancelled = false;

    loadSpotifyIframeApi().then(
      (api) => {
        if (cancelled || !hostRef.current || !wantedUriRef.current) return;
        // Our own child, not a React-rendered node, because Spotify swaps it for its iframe.
        const landing = document.createElement("div");
        hostRef.current.replaceChildren(landing);
        const createdUri = wantedUriRef.current;
        api.createController(landing, { uri: createdUri, width: "100%", height: EMBED_HEIGHT }, (controller) => {
          if (cancelled) {
            controller.destroy();
            return;
          }
          controllerRef.current = controller;
          controller.addListener("ready", () => {
            if (controllerRef.current !== controller) return;
            if (wantedUriRef.current && wantedUriRef.current !== createdUri) {
              controller.loadUri(wantedUriRef.current);
            }
            setStatus("ready");
            // May be refused by a browser that wants a gesture of its own; the embed's play
            // button is right there for that.
            controller.play();
          });
          controller.addListener("playback_update", (e: { data: PlaybackUpdate }) => {
            if (controllerRef.current !== controller) return;
            const { isPaused, isBuffering, duration, position } = e.data;
            setPlayback({ isPaused, isBuffering, duration, position });
          });
        });
      },
      () => {
        if (cancelled) return;
        setStatus("failed");
        trackEvent("recording-failed", { reason: "unavailable" });
      },
    );

    return () => {
      cancelled = true;
    };
  }, [status]);

  // Pages that run along the bottom edge (the footer, the back-to-top button) clear the dock
  // through this attribute; see globals.css for --audio-dock-height.
  useEffect(() => {
    if (status === "closed") return;
    document.documentElement.setAttribute("data-audio-dock", "");
    return () => document.documentElement.removeAttribute("data-audio-dock");
  }, [status]);

  const togglePlay = useCallback(() => {
    controllerRef.current?.togglePlay();
  }, []);

  const play = useCallback(
    (next: Recording) => {
      const link = parseSpotifyLink(next.link);
      if (!link) {
        // The failure view takes the embed's place, so let the embed go rather than keep a
        // controller whose iframe is gone; the next good link starts afresh.
        controllerRef.current?.destroy();
        controllerRef.current = null;
        wantedUriRef.current = null;
        setRecording(next);
        setParsed(null);
        setPlayback(null);
        setStatus("failed");
        trackEvent("recording-failed", { reason: "invalid-link" });
        return;
      }
      if (controllerRef.current && wantedUriRef.current === link.uri) {
        controllerRef.current.togglePlay();
        return;
      }

      // Where focus goes back to on close: the link that was tapped. When the dock is already
      // open its own title may hold focus; that is not a place to return to.
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== document.body && !dockRef.current?.contains(active)) {
        returnFocusRef.current = active;
      }
      wantedUriRef.current = link.uri;
      setRecording(next);
      setParsed(link);
      setPlayback(null);
      trackEvent("recording-played", { option: link.kind, route: routePattern(pathname ?? "") });

      if (controllerRef.current) {
        controllerRef.current.loadUri(link.uri);
        controllerRef.current.play();
        return;
      }
      setStatus("starting");
    },
    [pathname],
  );

  const close = useCallback(() => {
    controllerRef.current?.destroy();
    controllerRef.current = null;
    wantedUriRef.current = null;
    setStatus("closed");
    setRecording(null);
    setParsed(null);
    setPlayback(null);
    returnFocusRef.current?.focus?.();
    returnFocusRef.current = null;
  }, []);

  const isCurrent = useCallback(
    (link: string) => parsed !== null && parseSpotifyLink(link)?.uri === parsed.uri,
    [parsed],
  );

  const value = useMemo<AudioPlayerContextValue>(
    () => ({ status, recording, playback, play, togglePlay, close, isCurrent }),
    [status, recording, playback, play, togglePlay, close, isCurrent],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      <AudioPlayerDock
        status={status}
        recording={recording}
        spotifyUrl={parsed?.url ?? null}
        hostRef={hostRef}
        regionRef={dockRef}
        onClose={close}
      />
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}
