import { describe, expect, it } from "vitest";
import { parseSpotifyLink } from "@/lib/spotify-link";

describe("parseSpotifyLink", () => {
  it("reads an episode link from open.spotify.com", () => {
    expect(parseSpotifyLink("https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5")).toEqual({
      kind: "episode",
      id: "7makk4oTQel546B0PZlDM5",
      uri: "spotify:episode:7makk4oTQel546B0PZlDM5",
      url: "https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5",
    });
  });

  it("drops the share query and a trailing slash", () => {
    const parsed = parseSpotifyLink("https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ/?si=abc123&nd=1");
    expect(parsed?.kind).toBe("track");
    expect(parsed?.id).toBe("0Lr4kGOYn9l83EjuK6cZFQ");
    expect(parsed?.url).toBe("https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ");
  });

  it("accepts a localised path prefix", () => {
    expect(parseSpotifyLink("https://open.spotify.com/intl-de/album/4aawyAB9vmqN3uQ7FjRGTy")?.uri).toBe(
      "spotify:album:4aawyAB9vmqN3uQ7FjRGTy",
    );
  });

  it("accepts a Spotify URI", () => {
    expect(parseSpotifyLink("spotify:show:4rOoJ6Egrf8K2IrywzwOMk")).toEqual({
      kind: "show",
      id: "4rOoJ6Egrf8K2IrywzwOMk",
      uri: "spotify:show:4rOoJ6Egrf8K2IrywzwOMk",
      url: "https://open.spotify.com/show/4rOoJ6Egrf8K2IrywzwOMk",
    });
  });

  it("accepts playlists and artists", () => {
    expect(parseSpotifyLink("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")?.kind).toBe("playlist");
    expect(parseSpotifyLink("spotify:artist:0TnOYISbd1XYRBk9myaseg")?.kind).toBe("artist");
  });

  it("rejects other hosts, unknown kinds and malformed ids", () => {
    expect(parseSpotifyLink("https://example.com/episode/7makk4oTQel546B0PZlDM5")).toBeNull();
    expect(parseSpotifyLink("https://open.spotify.com/user/someone")).toBeNull();
    expect(parseSpotifyLink("https://open.spotify.com/episode/")).toBeNull();
    expect(parseSpotifyLink("spotify:episode:not an id")).toBeNull();
    expect(parseSpotifyLink("")).toBeNull();
    expect(parseSpotifyLink("just words")).toBeNull();
  });

  it("ignores surrounding whitespace", () => {
    expect(parseSpotifyLink("  https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5 \n")?.id).toBe(
      "7makk4oTQel546B0PZlDM5",
    );
  });
});
