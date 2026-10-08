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

export interface EssayDto {
  slug: string;
  urduTitle: string;
  blocks: Block[];
}

/** What the static pages know about an essay: never its text. */
export interface EssayMeta {
  slug: string;
  title: string;
  urduTitle: string;
}
