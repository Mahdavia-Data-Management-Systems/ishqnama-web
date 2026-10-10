"use client";

import type { ReactNode } from "react";
import Icon from "@/components/ui/icon";
import { useAudioPlayer } from "@/context/audio-player-context";
import styles from "./playable-link.module.css";

interface PlayableLinkProps {
  /** The recording's Spotify link or URI. */
  link: string;
  /** What the dock shows while it plays, e.g. "Dua for completing the Quran". */
  title: string;
  subtitle?: string;
  /** The words on the page, in whatever script and size the surrounding text uses. */
  children: ReactNode;
  className?: string;
}

/**
 * Text a reader can tap to hear a recording. A button rather than a link, because it plays here
 * instead of going anywhere; it inherits the font and size of the text around it, with a small
 * play glyph before the words that turns to pause while this recording is playing. Tapping it
 * again pauses and resumes. Open to everyone: the page around it does any gating.
 */
export default function PlayableLink({ link, title, subtitle, children, className = "" }: PlayableLinkProps) {
  const { play, isCurrent, playback } = useAudioPlayer();
  const playing = isCurrent(link) && playback !== null && !playback.isPaused;

  return (
    <button
      type="button"
      aria-pressed={playing}
      className={`${styles.link} ${className}`}
      onClick={() => play(subtitle === undefined ? { link, title } : { link, title, subtitle })}
    >
      <Icon name={playing ? "pause" : "play"} size={14} className={styles.glyph} />
      <span>{children}</span>
    </button>
  );
}
