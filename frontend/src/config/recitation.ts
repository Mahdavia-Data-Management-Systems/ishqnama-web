import { ABDUL_BASIT_MURATTAL } from "@/data/recitations/abdul-basit-murattal";
import type { RecitationTimings } from "@/lib/recitation-playlist";

/**
 * Where the recitation files live: one Cloudflare R2 bucket behind this custom domain, shared
 * by dev, prod and local development (audio is not environment data). The env var exists only
 * for testing against another bucket; no environment sets it. Setup is in infra/README.md.
 */
export const RECITATION_AUDIO_ORIGIN =
  process.env.NEXT_PUBLIC_RECITATION_AUDIO_ORIGIN ?? "https://audio.ishqnama.com";

/** A recitation the reader can choose. Its id, the reader's saved `reciter` setting, is `timings.id`. */
export interface RecitationOption {
  /** The entry in the settings sheet's Reciter list: who, and in what style. */
  name: string;
  /** The reciter alone, for the lock screen. */
  reciter: string;
  timings: RecitationTimings;
}

/** Every recitation on offer, in the order the Reciter setting lists them. */
export const RECITATIONS: readonly RecitationOption[] = [
  { name: "Abdul Basit Abdul Samad - Murattal", reciter: "Abdul Basit Abdul Samad", timings: ABDUL_BASIT_MURATTAL },
];

/** The recitation for readers with no saved choice; its id is also the backend's default for the setting. */
export const RECITATION: RecitationOption = RECITATIONS[0];

/** The recitation a saved `reciter` setting names; the default for one no longer offered. */
export function recitationById(id: string | undefined): RecitationOption {
  return RECITATIONS.find((r) => r.timings.id === id) ?? RECITATION;
}
