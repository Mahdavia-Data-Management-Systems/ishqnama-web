"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import PodcastThumbnail from "@/components/podcast/podcast-thumbnail";
import { PODCAST_COPY } from "@/config/podcast-copy";
import { useSignInGate } from "@/context/sign-in-prompt-context";
import { formatDuration, podcastFileUrl, reflectionEpisode } from "@/lib/podcast-timeline";
import type { Reflection } from "@/types/articles";
import ReflectionDescriptionDialog from "./reflection-description-dialog";
import ReflectionPlayer from "./reflection-player";
import { useReflectionPlayer } from "./reflection-player-context";
import styles from "./reflection-item.module.css";

interface ReflectionItemProps {
  reflection: Reflection;
}

/**
 * One recording about an essay, as a card of the reflections list: its picture card with the
 * recording's length in the corner, its caption (its title is only the essay's) and its
 * description, one under another. The picture is the way to hear it: a tap opens the hosts'
 * bubble (`ReflectionPlayer`) and the recording starts, one recording at a time across the list
 * (`useReflectionPlayer`). Listening is for signed-in readers: an anonymous reader sees the
 * whole card, and the tap opens the sign-in prompt instead. The description shows as many whole lines as its box holds (six,
 * from the stylesheet); when there is more of it, the last line ends in an ellipsis and Read
 * more opens the whole of it in a dialog.
 */
export default function ReflectionItem({ reflection }: ReflectionItemProps) {
  const { thumbnail, durationMs } = reflection;
  const caption = reflection.caption ?? reflection.title;
  const boxRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const readMoreRef = useRef<HTMLButtonElement>(null);
  const [clipped, setClipped] = useState(false);
  const [open, setOpen] = useState(false);
  const player = useReflectionPlayer();
  const gate = useSignInGate("reflections");
  const listening = player.openUrl === reflection.url;
  const episode = episodeOf(reflection.url);

  // The description is clamped to the whole lines that fit its box, so no line is cut in half
  // and none peeks under the ellipsis; the clamp and whether anything was cut are remeasured
  // whenever that box changes size (a wider card, a font the reader scaled).
  useLayoutEffect(() => {
    const box = boxRef.current;
    const el = descriptionRef.current;
    if (!box || !el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 1;
      el.style.setProperty("--description-lines", String(Math.max(1, Math.floor(box.clientHeight / lineHeight))));
      setClipped(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [reflection.description]);

  const close = useCallback(() => {
    setOpen(false);
    readMoreRef.current?.focus();
  }, []);

  const stopListening = useCallback(() => player.setOpenUrl(null), [player]);

  return (
    <li className={styles.item}>
      {episode && (
        <button
          type="button"
          className={thumbnail ? styles.play : styles.playPlain}
          aria-label={`${PODCAST_COPY.listen}: ${caption}`}
          aria-pressed={listening}
          onClick={() => gate(() => player.setOpenUrl(reflection.url))}
        >
          {thumbnail ? (
            <>
              <PodcastThumbnail
                className={styles.thumbnail}
                title={thumbnail.title}
                imageUrl={podcastFileUrl(thumbnail.url)}
                align={thumbnail.align}
                duration={durationMs === undefined ? undefined : formatDuration(durationMs)}
              />
              <span className={styles.playGlyph} aria-hidden="true">
                <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 4l14 8-14 8z" />
                </svg>
              </span>
            </>
          ) : (
            PODCAST_COPY.listen
          )}
        </button>
      )}
      <h2 className={styles.caption}>{caption}</h2>
      {listening && episode && <ReflectionPlayer episode={episode.episode} version={episode.version} onClose={stopListening} />}
      {reflection.description && (
        <>
          <div ref={boxRef} className={styles.descriptionBox}>
            <p ref={descriptionRef} className={styles.description}>
              {reflection.description}
            </p>
          </div>
          {/* Always in the layout, so showing it never changes how many lines fit */}
          <div className={styles.more} data-clipped={clipped || undefined}>
            <button ref={readMoreRef} type="button" className={styles.readMore} onClick={() => setOpen(true)} tabIndex={clipped ? 0 : -1}>
              {PODCAST_COPY.readMore}
            </button>
          </div>
          <ReflectionDescriptionDialog isOpen={open} title={caption} description={reflection.description} onClose={close} />
        </>
      )}
    </li>
  );
}

/** The episode a reflection's `url` names, or null for one that is not a released timeline. */
function episodeOf(url: string): { episode: string; version: number } | null {
  try {
    return reflectionEpisode(url);
  } catch {
    return null;
  }
}
