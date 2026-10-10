"use client";

import { useEffect, useRef, type RefObject } from "react";
import { usePathname } from "next/navigation";
import IconButton from "@/components/ui/icon-button";
import { AUDIO_COPY } from "@/config/audio-copy";
import { isReaderRoute } from "@/lib/reader-route";
import type { AudioPlayerStatus, Recording } from "@/context/audio-player-context";
import styles from "./audio-player-dock.module.css";

interface AudioPlayerDockProps {
  status: AudioPlayerStatus;
  recording: Recording | null;
  /** Spotify's own page for the recording, offered when it cannot start here. */
  spotifyUrl: string | null;
  /** Where the provider lets Spotify put its embed. Rendered while starting and ready. */
  hostRef: RefObject<HTMLDivElement | null>;
  /** The dock itself, so the provider can tell focus inside it from focus on the page. */
  regionRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/**
 * The bar a recording plays in: our title line over Spotify's compact embed. Full width above
 * the bottom nav or reader toolbar on phones, a card in the bottom right corner from 641 px up.
 * Not a dialog: the page stays usable and scrolls freely underneath, and it stays put while the
 * reader moves between pages. Rendered once, by AudioPlayerProvider.
 */
export default function AudioPlayerDock({
  status,
  recording,
  spotifyUrl,
  hostRef,
  regionRef,
  onClose,
}: AudioPlayerDockProps) {
  const pathname = usePathname();
  const titleRef = useRef<HTMLParagraphElement>(null);
  const open = status !== "closed";

  // Take focus on opening so a keyboard reader lands on what is playing. The provider hands
  // focus back to the link that started it on close.
  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  if (!open || !recording) return null;

  return (
    <section
      ref={regionRef}
      role="region"
      aria-label={AUDIO_COPY.regionLabel}
      className={styles.dock}
      data-clears={isReaderRoute(pathname) ? "toolbar" : "bottom-nav"}
    >
      <div className={styles.titleRow}>
        <p ref={titleRef} tabIndex={-1} className={styles.title}>
          {recording.title}
          {recording.subtitle && <span className={styles.subtitle}>{recording.subtitle}</span>}
        </p>
        <IconButton icon="close" label={AUDIO_COPY.closeRecording} size="sm" onClick={onClose} className={styles.close} />
      </div>
      {status === "failed" ? (
        <p className={styles.failure}>
          {AUDIO_COPY.couldNotStart}
          {spotifyUrl && (
            <>
              {" "}
              <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" className={styles.outLink}>
                {AUDIO_COPY.openInSpotify}
              </a>
            </>
          )}
        </p>
      ) : (
        <div ref={hostRef} className={styles.host} data-state={status} />
      )}
    </section>
  );
}
