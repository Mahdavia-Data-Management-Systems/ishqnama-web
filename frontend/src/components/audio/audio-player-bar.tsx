"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import IconButton from "@/components/ui/icon-button";
import { AUDIO_COPY } from "@/config/audio-copy";
import { useAudioPlayer } from "@/context/audio-player-context";
import { useReaderSettings } from "@/context/reader-settings-context";
import { useSignInGate } from "@/context/sign-in-prompt-context";
import { verseQuery } from "@/lib/recitation-playlist";
import { isReaderRoute } from "@/lib/reader-route";
import styles from "./audio-player-bar.module.css";

/**
 * The strip along the bottom edge while a recording plays: previous, play/pause, next, what is
 * playing (a link back to its page), the settings gear (the sheet on its recitation section;
 * anonymous readers get the sign-in prompt, as from the reader toolbar), close. Rendered by
 * AudioPlayerProvider; sits above the reader toolbar on reader routes and above the phone
 * bottom nav elsewhere. Never takes focus when it appears, the reader is still reading.
 */
export default function AudioPlayerBar() {
  const pathname = usePathname();
  const { status, playlist, index, current, pause, resume, next, previous, close } = useAudioPlayer();
  const { openSettings } = useReaderSettings();
  const gateSettings = useSignInGate("settings");
  if (!playlist || index == null || !current) return null;

  const clears = isReaderRoute(pathname) ? "toolbar" : "bottom-nav";
  const playing = status === "playing" || status === "loading";
  const href = playlist.href && current.ref ? verseQuery(current.ref, playlist.href) : playlist.href;
  // The chapter name and the verse as two parts, the way the share sheet and the lock screen
  // name a verse ("al-Baqarah, verse 255"), not one string with a dot between.
  const label = (
    <>
      <span className={styles.titleName}>{current.title}</span>
      {current.subtitle && <span className={styles.titleVerse}>{current.subtitle}</span>}
    </>
  );

  return (
    <section className={styles.bar} data-clears={clears} aria-label={AUDIO_COPY.regionLabel} role="region">
      <div className={styles.inner}>
        <div className={styles.transport}>
          <IconButton icon="skipBack" label={AUDIO_COPY.previousVerse} size="sm" onClick={previous} disabled={index === 0} />
          <button
            type="button"
            className={`${styles.playPause} ${status === "loading" ? styles.breathing : ""}`}
            aria-label={playing ? AUDIO_COPY.pause : AUDIO_COPY.resume}
            onClick={playing ? pause : resume}
          >
            <IconGlyph playing={playing} />
          </button>
          <IconButton icon="skipForward" label={AUDIO_COPY.nextVerse} size="sm" onClick={next} disabled={index + 1 >= playlist.clips.length} />
        </div>

        {status === "failed" ? (
          <div className={styles.failed}>
            <span className={styles.failedText}>{AUDIO_COPY.couldNotStart}</span>
            <button type="button" className={styles.tryAgain} onClick={resume}>
              {AUDIO_COPY.tryAgain}
            </button>
          </div>
        ) : href ? (
          <Link href={href} className={styles.title}>{label}</Link>
        ) : (
          <span className={styles.title}>{label}</span>
        )}

        <IconButton
          icon="settings"
          label={AUDIO_COPY.settings}
          size="sm"
          onClick={() => gateSettings(() => openSettings("recitation"))}
        />
        <IconButton icon="close" label={AUDIO_COPY.closeRecording} size="sm" onClick={close} />
      </div>
    </section>
  );
}

function IconGlyph({ playing }: { playing: boolean }) {
  // Inline so the disabled styling of IconButton never applies to the main control.
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill={playing ? "none" : "currentColor"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={playing ? "M8 5v14M16 5v14" : "M6 4l14 8-14 8z"} />
    </svg>
  );
}
