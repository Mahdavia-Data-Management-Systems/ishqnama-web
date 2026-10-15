"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { MASCOTS } from "@/config/podcast";
import { PODCAST_COPY } from "@/config/podcast-copy";
import { useAudioLevel } from "@/hooks/use-audio-level";
import { useAppBarBottom } from "@/lib/app-bar-offset";
import { mascotStates, turnAt, type PodcastTimeline, type PodcastTurn } from "@/lib/podcast-timeline";
import ThemedLogo from "@/components/themed-logo";
import MascotAvatar from "./mascot-avatar";
import styles from "./podcast-bubble.module.css";

interface PodcastBubbleProps {
  timeline: PodcastTimeline;
  audioUrl: string;
  /** Start as soon as it opens; only from a tap, or the browser refuses. */
  autoPlay?: boolean;
  onClose: () => void;
}

type Status = "idle" | "playing" | "paused" | "failed";

/**
 * The hosts' discussion, docked in the corner: the Ishqnama mark and the topic's title and
 * caption at the head, a speech balloon that carries the words and
 * fills the height, its tail pointing down at whoever has the floor, both portraits beneath it,
 * and one row of controls. Owns its own `<audio>` (cross-origin, so the Web Audio analyser may
 * read it) and follows the recording frame by frame against the timeline. It is as tall as the
 * viewport allows below the app bar, which is sticky and scrolls away on a long page, so the
 * bar's real bottom edge comes from `useAppBarBottom` and the stylesheet subtracts it.
 */
export default function PodcastBubble({ timeline, audioUrl, autoPlay = false, onClose }: PodcastBubbleProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [ms, setMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [liveLevel, setLiveLevel] = useState(false);

  useEffect(() => setAudio(audioRef.current), []);
  const barBottom = useAppBarBottom();

  const onLevel = useCallback((value: number) => {
    setLiveLevel(true);
    // Two decimals is below what the eye reads; skipping equal values saves renders.
    setLevel(Math.round(value * 100) / 100);
  }, []);
  useAudioLevel(audio, status === "playing", onLevel);

  // Follow the position every frame while playing; `timeupdate` alone fires only a few times
  // a second, which would hand the floor over late.
  useEffect(() => {
    if (status !== "playing" || !audio) return;
    let frame = 0;
    const tick = () => {
      setMs(Math.round(audio.currentTime * 1000));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status, audio]);

  const play = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    setStatus("playing");
    el.play().catch(() => setStatus("failed"));
  }, []);

  useEffect(() => {
    if (autoPlay) play();
  }, [autoPlay, play]);

  const pause = () => audioRef.current?.pause();
  const seek = (value: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = value / 1000;
    setMs(value);
  };

  const turn = turnAt(timeline, ms);
  const caption = turn ?? lastTurnBefore(timeline, ms);
  const states = mascotStates(timeline, ms);
  const cast = MASCOTS.filter((m) => m.id in states);
  const speakerName = turn ? cast.find((m) => m.id === turn.speaker)?.name : undefined;
  const playing = status === "playing";
  const style = { "--clear-top": barBottom == null ? "var(--header-height)" : `${barBottom}px` } as CSSProperties;

  return (
    <section
      className={styles.bubble}
      style={style}
      role="region"
      aria-label={PODCAST_COPY.regionLabel}
      data-speaker={turn?.speaker ?? ""}
      data-cast={cast.length}
      data-glow={playing && !liveLevel ? "steady" : "live"}
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        crossOrigin="anonymous"
        preload="metadata"
        onPlay={() => setStatus("playing")}
        onPause={() => setStatus((s) => (s === "failed" ? s : "paused"))}
        onEnded={() => setStatus("paused")}
        onError={() => setStatus("failed")}
        onTimeUpdate={(e) => setMs(Math.round(e.currentTarget.currentTime * 1000))}
      />

      <header className={styles.head}>
        <div className={styles.brand}>
          <ThemedLogo alt="Ishqnama" width={22} height={22} className={styles.mark} />
          <span className={styles.wordmark}>{PODCAST_COPY.brand}</span>
        </div>
        {timeline.title && (
          <h2 className={styles.topicTitle} dir="auto">
            {timeline.title}
          </h2>
        )}
        {timeline.caption && <p className={styles.topicCaption}>{timeline.caption}</p>}
      </header>

      <button type="button" className={styles.close} aria-label={PODCAST_COPY.close} onClick={onClose}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      <div className={styles.balloon}>
        {caption ? (
          <p className={styles.words} lang={timeline.language || undefined} dir="auto">
            {caption.text || "…"}
          </p>
        ) : (
          <p className={styles.opening}>{PODCAST_COPY.opening}</p>
        )}
      </div>

      <div className={styles.cast}>
        {cast.map((mascot) => {
          const state = states[mascot.id]!;
          return <MascotAvatar key={mascot.id} mascot={mascot} expression={state.expression} speaking={state.speaking} level={level} />;
        })}
      </div>
      <span className={styles.announce} aria-live="polite">
        {speakerName ? PODCAST_COPY.speaking(speakerName) : ""}
      </span>

      {status === "failed" ? (
        <div className={styles.failed}>
          <span>{PODCAST_COPY.couldNotStart}</span>
          <button type="button" className={styles.tryAgain} onClick={play}>
            {PODCAST_COPY.tryAgain}
          </button>
        </div>
      ) : (
        <div className={styles.transport}>
          <button type="button" className={styles.playPause} aria-label={playing ? PODCAST_COPY.pause : PODCAST_COPY.resume} onClick={playing ? pause : play}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill={playing ? "none" : "currentColor"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={playing ? "M8 5v14M16 5v14" : "M6 4l14 8-14 8z"} />
            </svg>
          </button>
          <input
            type="range"
            className={styles.seek}
            aria-label={PODCAST_COPY.seek}
            min={0}
            max={timeline.durationMs}
            step={250}
            value={Math.min(ms, timeline.durationMs)}
            onChange={(e) => seek(Number(e.target.value))}
          />
          <span className={styles.time}>
            {clock(ms)} / {clock(timeline.durationMs)}
          </span>
        </div>
      )}
    </section>
  );
}

/** The turn most recently finished, so a pause keeps the last words up instead of blanking. */
function lastTurnBefore(timeline: PodcastTimeline, ms: number): PodcastTurn | null {
  let found: PodcastTurn | null = null;
  for (const turn of timeline.turns) {
    if (turn.toMs <= ms) found = turn;
    else break;
  }
  return found;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
