"use client";

import PodcastBubble from "@/components/podcast/podcast-bubble";
import { PODCAST_COPY } from "@/config/podcast-copy";
import { useEpisode } from "@/hooks/use-episode";
import styles from "./reflection-item.module.css";

interface ReflectionPlayerProps {
  episode: string;
  version: number;
  onClose: () => void;
}

/**
 * A recording's discussion, opened from its card: fetches the released timeline (only now, so a
 * page of cards costs nothing until one is tapped) and docks the hosts' bubble, which starts
 * playing as it opens. Shows nothing while the timeline is on its way, and a line in the card
 * when the recording cannot be reached.
 */
export default function ReflectionPlayer({ episode, version, onClose }: ReflectionPlayerProps) {
  const { status, timeline, audioUrl } = useEpisode(episode, version);
  if (status === "unavailable") {
    return (
      <p className={styles.unavailable} role="status">
        {PODCAST_COPY.unavailable}
      </p>
    );
  }
  if (!timeline || !audioUrl) return null;
  return <PodcastBubble timeline={timeline} audioUrl={audioUrl} autoPlay onClose={onClose} />;
}
