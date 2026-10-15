"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import PodcastBubble from "@/components/podcast/podcast-bubble";
import { DEFAULT_LAB_EPISODE } from "@/config/podcast";
import { PODCAST_COPY } from "@/config/podcast-copy";
import { useEpisode } from "@/hooks/use-episode";
import shell from "../../static-page.module.css";
import styles from "./podcast-lab.module.css";

/**
 * A plain page with one button, to try the hosts' bubble against a real episode before the
 * feature has a home: `?episode=<path under /podcasts/>` picks the recording.
 */
export default function PodcastLab() {
  const params = useSearchParams();
  const episode = params.get("episode") || DEFAULT_LAB_EPISODE;
  const { status, timeline, audioUrl } = useEpisode(episode);
  const [open, setOpen] = useState(false);

  return (
    <main className={shell.main}>
      <div className={shell.container}>
        <h1 className={shell.title}>A discussion from Noor e Imaan</h1>
        <div className={shell.body}>
          <p>Hamza and Zoya talk through a passage of the book, in their own words.</p>
          <p className={styles.episode}>{episode}</p>
          {status === "unavailable" ? (
            <p>{PODCAST_COPY.unavailable}</p>
          ) : (
            <button type="button" className={styles.listen} disabled={status !== "ready" || open} onClick={() => setOpen(true)}>
              {PODCAST_COPY.listen}
            </button>
          )}
        </div>
      </div>
      {open && timeline && audioUrl && <PodcastBubble timeline={timeline} audioUrl={audioUrl} autoPlay onClose={() => setOpen(false)} />}
    </main>
  );
}
