"use client";

import PlayableLink from "@/components/audio/playable-link";

const SAMPLE_TRACK = "https://open.spotify.com/episode/1LschR5C4miMncnUseXaq0?si=4XnItnXSRQGPRM6BZxuCqQ";

export default function TestPlayable() {
  return (
    <p>
      <PlayableLink link={SAMPLE_TRACK} title="A sample recording" subtitle="Test page">
        Listen to the sample recording
      </PlayableLink>
    </p>
  );
}
