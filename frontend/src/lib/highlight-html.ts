/** Escapes a reader's search text so it can be used inside a regular expression. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Wraps every match of `query` in the text of an HTML string in `<mark class="markClass">`,
 * case-insensitively, leaving the tags themselves untouched.
 */
export function highlightHtml(html: string, query: string, markClass: string): string {
  if (!query) return html;
  const matchRegex = new RegExp(escapeRegExp(query), "gi");
  return html.replace(/(<[^>]*>)|([^<]+)/g, (_segment, tag: string | undefined, text: string) => {
    if (tag) return tag;
    return text.replace(matchRegex, (m) => `<mark class="${markClass}">${m}</mark>`);
  });
}
