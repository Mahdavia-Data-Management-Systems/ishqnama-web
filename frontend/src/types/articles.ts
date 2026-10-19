/**
 * The shape of an essay as `GET /api/articles/nooreimaan/{slug}` returns it, written by
 * `scripts/build_nooreimaan_articles.py` and served verbatim by the API.
 */
export type RunKind = "urdu" | "quran" | "arabic" | "farsi" | "english";

export interface Run {
  kind: RunKind;
  text: string;
}

/** One row of the book's two-column translation tables; each cell is a list of paragraphs. */
export interface PairRow {
  quote: Run[][];
  rendering: Run[][];
}

export type Block =
  | { type: "p"; runs: Run[] }
  | { type: "h2"; id: string; runs: Run[] }
  | { type: "pair"; rows: PairRow[] };

/**
 * A podcast recording about the essay, attached by `scripts/diarize_podcast.py --article`.
 * `url` is the released timeline's path under the audio origin's `/podcasts/`, e.g.
 * `articles/nooreimaan/naskh/naskh.timeline.v1.json` (each essay's recordings in a folder named
 * after its slug); `reflectionEpisode()` turns it into the
 * episode and version the player takes.
 */
export interface Reflection {
  title: string;
  caption?: string;
  description?: string;
  url: string;
}

export interface EssayDto {
  slug: string;
  urduTitle: string;
  blocks: Block[];
  /** In display order; empty for an essay without recordings, which most are. */
  reflections: Reflection[];
}

/** What the static pages know about an essay: never its text. */
export interface EssayMeta {
  slug: string;
  title: string;
  urduTitle: string;
}
