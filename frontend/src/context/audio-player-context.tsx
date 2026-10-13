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
import AudioPlayerBar from "@/components/audio/audio-player-bar";
import { nearestRecitationSpeed } from "@/config/recitation";
import { useReaderSettings } from "@/context/reader-settings-context";
import type { Clip, Playlist } from "@/lib/recitation-playlist";
import { routePattern, trackEvent } from "@/lib/telemetry";

export type AudioPlayerStatus = "closed" | "loading" | "playing" | "paused" | "failed";

export interface AudioPlayerContextValue {
  status: AudioPlayerStatus;
  playlist: Playlist | null;
  index: number | null;
  current: Clip | null;
  /**
   * Starts this clip. The current clip of the current playlist (by id) pauses while playing
   * and resumes while paused. `trigger` gets focus back when the bar closes.
   */
  play: (playlist: Playlist, index: number, trigger?: HTMLElement | null) => void;
  pause: () => void;
  /** Also the way out of `failed`: tries the same clip again. */
  resume: () => void;
  next: () => void;
  previous: () => void;
  /** Stops, forgets the playlist, hides the bar. */
  close: () => void;
  isCurrent: (ref: { chapter: number; verse: number }) => boolean;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null);

/**
 * A clip starting within this many ms of the previous clip's end is "where it ends": the
 * audio runs on untouched, since the export pads verse boundaries by a few hundred ms and a
 * seek there would only stutter. Beyond it the player seeks (forwards over a gap, backwards
 * over an overlap).
 */
export const BOUNDARY_TOLERANCE_MS = 300;

/** Position disagreement the metadata check lets pass: the media fragment landed close enough. */
const FRAGMENT_SLACK_S = 0.5;

function url(clip: Clip): string {
  return clip.fromMs != null ? `${clip.url}#t=${clip.fromMs / 1000}` : clip.url;
}
/** The file the element holds, without the media fragment; "" when nothing is loaded. */
function loadedUrl(audio: HTMLAudioElement): string {
  return audio.src ? audio.src.split("#")[0] : "";
}

/**
 * Owns the one Audio element for the whole site and the bar that shows what it plays. Mounted
 * once in AppShell, inside the reader settings (for the continue setting and the bar's gear)
 * but around every page, so playback survives navigation; it needs no account, so it works for
 * anonymous readers. Knows nothing about verses: it plays clips, and pages ask isCurrent(ref)
 * to highlight. The element is created on the first play, inside the reader's tap, which
 * unlocks it; later file changes on the same element may call play() outside a gesture.
 */
export default function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { continueRecitation, recitationSpeed } = useReaderSettings();
  const speed = nearestRecitationSpeed(recitationSpeed);
  const [status, setStatus] = useState<AudioPlayerStatus>("closed");
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [index, setIndex] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Mirrors of the state for the audio event handlers, which must not go stale between renders.
  const playlistRef = useRef<Playlist | null>(null);
  const indexRef = useRef<number | null>(null);
  const statusRef = useRef<AudioPlayerStatus>("closed");
  const triggerRef = useRef<HTMLElement | null>(null);
  const barHostRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number>(0);
  // Each play() gets a ticket; a play promise settling for an older ticket is ignored.
  const ticketRef = useRef(0);
  // The continue setting as the audio event handlers see it; a change applies at the next verse end.
  const continueRef = useRef(continueRecitation);
  useEffect(() => {
    continueRef.current = continueRecitation;
  }, [continueRecitation]);
  // The speed reaches the element at once, and the default rate too, since a load resets the
  // rate to the default and the next file would otherwise fall back to normal speed.
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
    const audio = audioRef.current;
    if (audio) {
      audio.defaultPlaybackRate = speed;
      audio.playbackRate = speed;
    }
  }, [speed]);

  const setStatusBoth = useCallback((s: AudioPlayerStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);
  const setIndexBoth = useCallback((i: number | null) => {
    indexRef.current = i;
    setIndex(i);
  }, []);
  const setPlaylistBoth = useCallback((p: Playlist | null) => {
    playlistRef.current = p;
    setPlaylist(p);
  }, []);

  const currentClip = useCallback((): Clip | null => {
    const p = playlistRef.current;
    const i = indexRef.current;
    return p && i != null ? (p.clips[i] ?? null) : null;
  }, []);

  /** Calls play() on the element and reflects the outcome once it settles. */
  const startElement = useCallback((audio: HTMLAudioElement) => {
    const ticket = ++ticketRef.current;
    audio.play().then(
      () => { /* the "playing" event sets the status */ },
      (err: unknown) => {
        if (ticket !== ticketRef.current) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "AbortError") return;
        setStatusBoth("failed");
        trackEvent("recording-failed", { reason: name === "NotAllowedError" ? "blocked" : "audio" });
      },
    );
  }, [setStatusBoth]);

  /** Loads (if needed), positions and starts the clip at `i` of the current playlist. */
  const startClip = useCallback((i: number) => {
    const audio = audioRef.current;
    const p = playlistRef.current;
    if (!audio || !p) return;
    const clip = p.clips[i];
    if (!clip) return;
    setIndexBoth(i);

    // Decided by what the element has actually loaded, never by the previous clip: a verse
    // tapped on another page belongs to a new playlist that may share nothing with the file
    // playing, and must never be heard as a seek inside it.
    if (loadedUrl(audio) === clip.url) {
      // Same file: a seek, or nothing at all when the clip starts where the last one ended.
      const wantedS = (clip.fromMs ?? 0) / 1000;
      const drift = Math.abs(audio.currentTime - wantedS) * 1000;
      if (drift > BOUNDARY_TOLERANCE_MS) audio.currentTime = wantedS;
      if (audio.paused) {
        setStatusBoth("loading");
        startElement(audio);
      }
      return;
    }

    setStatusBoth("loading");
    audio.src = url(clip);
    audio.preload = "auto";
    audio.load();
    startElement(audio);
  }, [setIndexBoth, setStatusBoth, startElement]);

  /**
   * Stops and forgets everything. Focus goes back to the button that started the recording
   * when the reader asked to close, or when the recitation ran out while their focus was on
   * the bar (which is about to disappear); a reader whose focus is elsewhere is left alone.
   */
  const stopAll = useCallback((focus: "always" | "ifInBar") => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
    }
    cancelAnimationFrame(frameRef.current);
    const trigger = triggerRef.current;
    const inBar = barHostRef.current?.contains(document.activeElement) ?? false;
    triggerRef.current = null;
    setIndexBoth(null);
    setPlaylistBoth(null);
    setStatusBoth("closed");
    if (trigger && trigger.isConnected && (focus === "always" || inBar)) trigger.focus();
  }, [setIndexBoth, setPlaylistBoth, setStatusBoth]);

  /**
   * What happens when the clip at `i` has been heard to its end: the next clip, unless it was
   * the last or the reader has asked for one verse at a time, in which case the bar closes.
   */
  const clipEnded = useCallback((i: number) => {
    const p = playlistRef.current;
    if (!p) return;
    if (!continueRef.current || i + 1 >= p.clips.length) {
      stopAll("ifInBar");
      return;
    }
    startClip(i + 1);
  }, [startClip, stopAll]);

  /** The position check both the frame loop and timeupdate run. */
  const checkPosition = useCallback(() => {
    const audio = audioRef.current;
    const clip = currentClip();
    const p = playlistRef.current;
    if (!audio || !clip || !p || statusRef.current !== "playing") return;
    if (clip.toMs == null) return;
    if (audio.currentTime * 1000 < clip.toMs) return;
    clipEnded(indexRef.current ?? 0);
  }, [clipEnded, currentClip]);

  // Wire the element's events once it exists.
  const ensureAudio = useCallback((): HTMLAudioElement => {
    if (audioRef.current) return audioRef.current;
    const audio = new Audio();
    audioRef.current = audio;
    audio.defaultPlaybackRate = speedRef.current;
    audio.playbackRate = speedRef.current;
    audio.addEventListener("playing", () => setStatusBoth("playing"));
    audio.addEventListener("pause", () => {
      if (statusRef.current === "playing") setStatusBoth("paused");
    });
    audio.addEventListener("timeupdate", checkPosition);
    audio.addEventListener("ended", () => {
      const i = indexRef.current;
      if (playlistRef.current && i != null) clipEnded(i);
    });
    audio.addEventListener("error", () => {
      if (statusRef.current === "closed") return;
      setStatusBoth("failed");
      trackEvent("recording-failed", { reason: "audio" });
    });
    audio.addEventListener("loadedmetadata", () => {
      // The #t= fragment usually lands the position; correct it when a browser ignores it.
      const clip = currentClip();
      if (!clip || clip.fromMs == null) return;
      const wantedS = clip.fromMs / 1000;
      if (Math.abs(audio.currentTime - wantedS) > FRAGMENT_SLACK_S) audio.currentTime = wantedS;
    });
    return audio;
  }, [checkPosition, clipEnded, currentClip, setStatusBoth]);

  // The frame loop, for tight verse boundaries while the tab is visible; timeupdate covers the
  // background tab.
  useEffect(() => {
    if (status !== "playing") return;
    let active = true;
    const tick = () => {
      if (!active) return;
      checkPosition();
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(frameRef.current);
    };
  }, [status, checkPosition]);

  // Pages that run along the bottom edge clear the bar through this attribute (globals.css).
  useEffect(() => {
    if (status === "closed") return;
    document.documentElement.setAttribute("data-audio-bar", "");
    return () => document.documentElement.removeAttribute("data-audio-bar");
  }, [status]);

  // Going offline pauses rather than fails; the reader resumes by hand.
  useEffect(() => {
    const onOffline = () => audioRef.current?.pause();
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    // A pause while still loading: the browser rejects the pending play with AbortError and
    // fires no "playing", so the "pause" handler above (which only acts on "playing") would
    // leave the bar breathing for ever.
    if (statusRef.current === "loading") setStatusBoth("paused");
  }, [setStatusBoth]);

  const resume = useCallback(() => {
    const i = indexRef.current;
    if (i == null) return;
    if (statusRef.current === "failed") {
      // Try the same clip afresh: a new load, in case the file itself failed.
      const audio = audioRef.current;
      if (audio) audio.removeAttribute("src");
      startClip(i);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    setStatusBoth("loading");
    startElement(audio);
  }, [setStatusBoth, startClip, startElement]);

  const play = useCallback((next: Playlist, i: number, trigger?: HTMLElement | null) => {
    const same = playlistRef.current?.id === next.id && indexRef.current === i && statusRef.current !== "closed";
    if (same) {
      if (statusRef.current === "playing" || statusRef.current === "loading") pause();
      else resume();
      return;
    }
    ensureAudio();
    if (trigger) triggerRef.current = trigger;
    setPlaylistBoth(next);
    trackEvent("recording-played", { route: routePattern(pathname ?? "") });
    startClip(i);
  }, [ensureAudio, pathname, pause, resume, setPlaylistBoth, startClip]);

  const next = useCallback(() => {
    const p = playlistRef.current;
    const i = indexRef.current;
    if (!p || i == null || i + 1 >= p.clips.length) return;
    startClip(i + 1);
  }, [startClip]);

  const previous = useCallback(() => {
    const i = indexRef.current;
    if (i == null || i === 0) return;
    startClip(i - 1);
  }, [startClip]);

  const close = useCallback(() => stopAll("always"), [stopAll]);

  const current = playlist && index != null ? (playlist.clips[index] ?? null) : null;

  const isCurrent = useCallback(
    (ref: { chapter: number; verse: number }) =>
      status !== "closed" && current?.ref?.chapter === ref.chapter && current?.ref?.verse === ref.verse,
    [current, status],
  );

  // Lock-screen and headset controls.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    if (status === "closed" || !current) {
      session.metadata = null;
      session.playbackState = "none";
      return;
    }
    session.metadata = new MediaMetadata({
      title: current.subtitle ? `${current.title}, ${current.subtitle}` : current.title,
      artist: playlist?.reciter,
      album: "Ishqnama",
    });
    session.playbackState = status === "playing" ? "playing" : "paused";
    session.setActionHandler("play", resume);
    session.setActionHandler("pause", pause);
    session.setActionHandler("nexttrack", next);
    session.setActionHandler("previoustrack", previous);
    return () => {
      for (const action of ["play", "pause", "nexttrack", "previoustrack"] as const) {
        session.setActionHandler(action, null);
      }
    };
  }, [status, current, resume, pause, next, previous]);

  const value = useMemo<AudioPlayerContextValue>(
    () => ({ status, playlist, index, current, play, pause, resume, next, previous, close, isCurrent }),
    [status, playlist, index, current, play, pause, resume, next, previous, close, isCurrent],
  );

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      {status !== "closed" && (
        // The host lets stopAll tell whether the reader's focus is on the bar before it goes.
        <div ref={barHostRef} style={{ display: "contents" }}>
          <AudioPlayerBar />
        </div>
      )}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
  return ctx;
}
