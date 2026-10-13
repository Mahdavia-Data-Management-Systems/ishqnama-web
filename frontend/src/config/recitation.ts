import { ABDUL_BASIT_MURATTAL } from "@/data/recitations/abdul-basit-murattal";

/**
 * Where the recitation files live: one Cloudflare R2 bucket behind this custom domain, shared
 * by dev, prod and local development (audio is not environment data). The env var exists only
 * for testing against another bucket; no environment sets it. Setup is in infra/README.md.
 */
export const RECITATION_AUDIO_ORIGIN =
  process.env.NEXT_PUBLIC_RECITATION_AUDIO_ORIGIN ?? "https://audio.ishqnama.com";

/** The one recitation offered today. A reciter setting would pick between several of these. */
export const RECITATION = ABDUL_BASIT_MURATTAL;

/** Shown on the lock screen and in the bar's accessible name. */
export const RECITER_NAME = "Abdul Basit Abdul Samad";
