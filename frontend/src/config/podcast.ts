/**
 * Where the podcast recordings and their timelines live: the same Cloudflare R2 bucket as the
 * recitation, under `/podcasts/<episode>.vN.<ext>` and `/podcasts/<episode>.timeline.vN.json`,
 * where the episode path names the article it discusses (`articles/nooreimaan/naskh`) and N is
 * the release version the onboarding skill's `--release` gave the file (they are served under a
 * one-year immutable cache header, so a change is always a new version). The repo's `audio/`
 * folder holds them at the same paths and `sync-audio.yml` copies it to the bucket. The env var
 * exists only for testing against another bucket or a local copy.
 */
export const PODCAST_AUDIO_ORIGIN =
  process.env.NEXT_PUBLIC_PODCAST_AUDIO_ORIGIN ?? process.env.NEXT_PUBLIC_RECITATION_AUDIO_ORIGIN ?? "https://audio.ishqnama.com";

/** A timeline's `speaker` value, and the folder of the mascot's images. */
export type MascotId = "hamza" | "zoya";

/** The four states a mascot's portrait has, one image each in `public/images/mascots/<id>/`. */
export type MascotExpression = "listening" | "speaking" | "laughing" | "thoughtful";

export interface Mascot {
  id: MascotId;
  /** The name as the reader sees it. */
  name: string;
}

/** The hosts, in the order they sit in the bubble: Hamza left, Zoya right. */
export const MASCOTS: readonly Mascot[] = [
  { id: "hamza", name: "Hamza" },
  { id: "zoya", name: "Zoya" },
];

export function mascotImage(id: MascotId, expression: MascotExpression): string {
  return `/images/mascots/${id}/${expression}.webp`;
}

/** The episode, and the released version of its timeline, the lab page opens when its query names none. */
export const DEFAULT_LAB_EPISODE = { episode: "articles/nooreimaan/naskh", version: 1 };
