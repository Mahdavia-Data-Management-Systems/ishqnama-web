import type { CitationDto, TakhreejBlockDto } from "@/types/api";

/**
 * Takhreej: the books that support a passage of the tafseer. In a segment's explanation HTML a
 * cited passage is `<mark>passage<ins data-takhreej="n"></ins></mark>`: the mark (no class)
 * wraps the passage, and the empty `<ins>` at its end is the anchor for block `n` (1-based per
 * segment) of the segment's `takhreej` array. A mark may hold its `<ins>` alone, with no passage.
 *
 * Older responses, cached for up to 30 days, carry the citations as text inside the `<ins>`,
 * one per line; those lines are kept so the reader still sees the sources.
 */

export type Citation = CitationDto;

export type TafseerPart =
  | { kind: "html"; html: string }
  | { kind: "takhreej"; passageHtml: string; ordinal?: number; inlineLines?: string[] };

export type TakhreejPart = Extract<TafseerPart, { kind: "takhreej" }>;

const BLOCK = /<mark>([\s\S]*?)<\/mark>|<ins\b([^>]*)>([\s\S]*?)<\/ins>/g;
const INS = /<ins\b([^>]*)>([\s\S]*?)<\/ins>/;
const INS_ALL = /<ins\b[^>]*>[\s\S]*?<\/ins>/g;
const ORDINAL = /\bdata-takhreej\s*=\s*["']?(\d+)/;
const ZERO_WIDTH_JOINER = /‍/g;
const LINE_EDGES = /^[\s,،]+|[\s,،]+$/g;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity]);
}

/** The citation lines an old-form `<ins>` holds: tags stripped, one entry per non-empty line. */
function inlineLinesOf(insHtml: string): string[] {
  return decodeEntities(insHtml.replace(/<[^>]*>/g, ""))
    .split(/\r?\n/)
    .map((line) => line.replace(ZERO_WIDTH_JOINER, "").replace(LINE_EDGES, ""))
    .filter(Boolean);
}

function anchorOf(attributes: string, insHtml: string): Pick<TakhreejPart, "ordinal" | "inlineLines"> | null {
  const ordinalMatch = ORDINAL.exec(attributes);
  const lines = inlineLinesOf(insHtml);
  if (!ordinalMatch && lines.length === 0) return null;
  return {
    ...(ordinalMatch ? { ordinal: Number(ordinalMatch[1]) } : {}),
    ...(lines.length > 0 ? { inlineLines: lines } : {}),
  };
}

/**
 * Splits an explanation into prose and cited passages, in text order. Prose comes back as it
 * was written. A mark without an anchor, or whose anchor names nothing, reads as plain prose.
 */
export function splitTakhreej(html: string): TafseerPart[] {
  const parts: TafseerPart[] = [];
  const pushHtml = (text: string) => {
    if (!text) return;
    const last = parts[parts.length - 1];
    if (last?.kind === "html") last.html += text;
    else parts.push({ kind: "html", html: text });
  };

  let cursor = 0;
  for (const match of html.matchAll(BLOCK)) {
    pushHtml(html.slice(cursor, match.index));
    cursor = match.index + match[0].length;

    const [, markInner, bareAttributes, bareInner] = match;
    if (markInner === undefined) {
      // An <ins> outside any mark: sources with no passage of their own.
      const anchor = anchorOf(bareAttributes, bareInner);
      if (anchor) parts.push({ kind: "takhreej", passageHtml: "", ...anchor });
      continue;
    }

    const ins = INS.exec(markInner);
    const passage = markInner.replace(INS_ALL, "");
    const anchor = ins ? anchorOf(ins[1], ins[2]) : null;
    if (!anchor) {
      pushHtml(passage);
      continue;
    }
    // Spaces at the passage's edges stay in the prose, so the wash and the icon hug the words.
    const trimmed = passage.trim();
    if (trimmed) pushHtml(passage.slice(0, passage.length - passage.trimStart().length));
    parts.push({ kind: "takhreej", passageHtml: trimmed, ...anchor });
    if (trimmed) pushHtml(passage.slice(passage.trimEnd().length));
  }
  pushHtml(html.slice(cursor));
  return parts;
}

/** The explanation as plain prose: passages unwrapped, anchors and their citations dropped. */
export function flattenTakhreej(html: string): string {
  return html.replace(BLOCK, (_block, markInner: string | undefined) =>
    markInner === undefined ? "" : markInner.replace(INS_ALL, ""),
  );
}

/**
 * The sources of one cited passage: the segment's structured citations when it has the block,
 * otherwise the lines an older response carried inside the anchor.
 */
export function citationsFor(
  part: TakhreejPart,
  blocks?: readonly TakhreejBlockDto[] | null,
): Citation[] | string[] {
  const block = part.ordinal === undefined ? undefined : blocks?.find((b) => b.ordinal === part.ordinal);
  if (block && block.citations.length > 0) return block.citations;
  return part.inlineLines ?? [];
}

const EASTERN_ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** The hijri mark after a year: heh with a zero-width joiner, so it takes its joining shape. */
export const HIJRI_MARK = "ه‍";

/** An author's death year as the books print it: Eastern Arabic digits and the hijri mark. */
export function year(n: number): string {
  const digits = String(Math.trunc(n)).replace(/\d/g, (d) => EASTERN_ARABIC_DIGITS[Number(d)]);
  return `${digits}${HIJRI_MARK}`;
}
