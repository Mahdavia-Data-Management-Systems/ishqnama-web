"use client";

import { useEffect, useState } from "react";
import { episodeUrls, parseTimeline, type PodcastTimeline } from "@/lib/podcast-timeline";

export type EpisodeStatus = "loading" | "ready" | "unavailable";

export interface Episode {
  status: EpisodeStatus;
  timeline: PodcastTimeline | null;
  /** The recording, resolved from the timeline's `audio` beside it. */
  audioUrl: string | null;
}

/**
 * Fetches an episode's timeline, at the given released version, from the audio origin and
 * resolves its recording's URL. An episode is a path under `/podcasts/` without extension;
 * anything that is not one, a version that is not a counting number, a missing file or a
 * timeline the parser rejects all end as `unavailable`.
 */
export function useEpisode(episode: string, version: number): Episode {
  const [state, setState] = useState<Episode>({ status: "loading", timeline: null, audioUrl: null });

  useEffect(() => {
    let urls: { timeline: string; folder: string };
    try {
      urls = episodeUrls(episode, version);
    } catch {
      setState({ status: "unavailable", timeline: null, audioUrl: null });
      return;
    }
    let cancelled = false;
    setState({ status: "loading", timeline: null, audioUrl: null });
    (async () => {
      try {
        const response = await fetch(urls.timeline);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const timeline = parseTimeline(await response.json());
        if (!cancelled) setState({ status: "ready", timeline, audioUrl: `${urls.folder}${timeline.audio}` });
      } catch {
        if (!cancelled) setState({ status: "unavailable", timeline: null, audioUrl: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [episode, version]);

  return state;
}
