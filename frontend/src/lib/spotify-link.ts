/**
 * Reads a Spotify link or URI into the parts the player needs. Content authors paste whatever
 * Spotify's Share gives them (a URL with `?si=`, sometimes with an `intl-xx/` prefix) or a
 * `spotify:` URI; the player wants the URI for the embed and a clean URL for "Open it in Spotify".
 */

export const SPOTIFY_KINDS = ["episode", "show", "track", "album", "playlist", "artist"] as const;

export type SpotifyKind = (typeof SPOTIFY_KINDS)[number];

export interface SpotifyLink {
  kind: SpotifyKind;
  id: string;
  /** `spotify:<kind>:<id>`, what the iframe API's loadUri takes. */
  uri: string;
  /** `https://open.spotify.com/<kind>/<id>`, without any query. */
  url: string;
}

const KIND = SPOTIFY_KINDS.join("|");
// Spotify ids are base62, 22 characters.
const ID = "[0-9A-Za-z]{22}";
const URL_PATTERN = new RegExp(`^https?://open\\.spotify\\.com/(?:intl-[a-z]{2,3}(?:-[a-z]{2})?/)?(${KIND})/(${ID})/?(?:[?#].*)?$`, "i");
const URI_PATTERN = new RegExp(`^spotify:(${KIND}):(${ID})$`, "i");

export function parseSpotifyLink(input: string | null | undefined): SpotifyLink | null {
  const text = (input ?? "").trim();
  if (!text) return null;
  const match = URL_PATTERN.exec(text) ?? URI_PATTERN.exec(text);
  if (!match) return null;
  const kind = match[1].toLowerCase() as SpotifyKind;
  const id = match[2];
  return {
    kind,
    id,
    uri: `spotify:${kind}:${id}`,
    url: `https://open.spotify.com/${kind}/${id}`,
  };
}
