import { describe, expect, it } from "vitest";
import { episodeUrls, formatDuration, mascotStates, parseTimeline, podcastFileUrl, reflectionEpisode, turnAt, type PodcastTimeline } from "../podcast-timeline";

describe("formatDuration", () => {
  it("reads like a clock, with hours only when there are any", () => {
    expect(formatDuration(96896)).toBe("1:37");
    expect(formatDuration(1188281)).toBe("19:48");
    expect(formatDuration(3725000)).toBe("1:02:05");
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(-5)).toBe("0:00");
  });
});

describe("podcastFileUrl", () => {
  it("serves a released file from the audio origin's /podcasts/", () => {
    expect(podcastFileUrl("articles/nooreimaan/naskh/naskh.thumbnail.v1.png")).toBe(
      "https://audio.ishqnama.com/podcasts/articles/nooreimaan/naskh/naskh.thumbnail.v1.png",
    );
    expect(podcastFileUrl("naskh.thumbnail.v1.png", "https://cdn.example/")).toBe("https://cdn.example/podcasts/naskh.thumbnail.v1.png");
  });

  it("refuses a path that leaves the folder or names no file", () => {
    expect(() => podcastFileUrl("../secrets.png")).toThrow(/released file/);
    expect(() => podcastFileUrl("articles/naskh")).toThrow(/released file/);
    expect(() => podcastFileUrl("https://x/naskh.png")).toThrow(/released file/);
  });
});

const timeline: PodcastTimeline = {
  version: 1,
  audio: "mustanifa_brief.m4a",
  durationMs: 10000,
  language: "ur",
  speakers: { hamza: { cluster: 1, medianPitchHz: 98, speechMs: 4000 }, zoya: { cluster: 0, medianPitchHz: 219, speechMs: 5000 } },
  turns: [
    { speaker: "zoya", fromMs: 200, toMs: 4000, expression: "thoughtful", text: "فرض کریں" },
    { speaker: "hamza", fromMs: 4500, toMs: 9000, expression: "speaking", text: "بالکل" },
  ],
};

describe("parseTimeline", () => {
  it("accepts a reviewed version 1 timeline", () => {
    expect(parseTimeline({ ...timeline, expressionsReviewed: true, voices: 2 })).toEqual(timeline);
  });

  it("keeps the topic's title and caption when the file has them", () => {
    const titled = parseTimeline({ ...timeline, title: "جملہ مستأنفہ", caption: "The resumptive clause" });
    expect(titled.title).toBe("جملہ مستأنفہ");
    expect(titled.caption).toBe("The resumptive clause");
    expect(parseTimeline(timeline).title).toBeUndefined();
  });

  it("rejects another version, an unknown speaker, an unknown expression and overlapping turns", () => {
    expect(() => parseTimeline({ ...timeline, version: 2 })).toThrow(/version/);
    expect(() => parseTimeline({ ...timeline, turns: [{ ...timeline.turns[0], speaker: "ali" }] })).toThrow(/speaker/);
    expect(() => parseTimeline({ ...timeline, turns: [{ ...timeline.turns[0], expression: "listening" }] })).toThrow(/expression/);
    expect(() => parseTimeline({ ...timeline, turns: [timeline.turns[0], { ...timeline.turns[1], fromMs: 3000 }] })).toThrow(/overlap/);
  });
});

describe("turnAt", () => {
  it("finds the turn under a moment, and nothing in a pause or past the end", () => {
    expect(turnAt(timeline, 200)).toBe(timeline.turns[0]);
    expect(turnAt(timeline, 3999)).toBe(timeline.turns[0]);
    expect(turnAt(timeline, 4000)).toBeNull();
    expect(turnAt(timeline, 4500)).toBe(timeline.turns[1]);
    expect(turnAt(timeline, 9500)).toBeNull();
    expect(turnAt(timeline, 0)).toBeNull();
  });
});

describe("mascotStates", () => {
  it("gives the speaker its turn's expression and everyone else listening", () => {
    expect(mascotStates(timeline, 1000)).toEqual({
      hamza: { expression: "listening", speaking: false },
      zoya: { expression: "thoughtful", speaking: true },
    });
    expect(mascotStates(timeline, 5000)).toEqual({
      hamza: { expression: "speaking", speaking: true },
      zoya: { expression: "listening", speaking: false },
    });
  });

  it("has everyone listening in a pause", () => {
    expect(mascotStates(timeline, 4200)).toEqual({
      hamza: { expression: "listening", speaking: false },
      zoya: { expression: "listening", speaking: false },
    });
  });

  it("keeps the mascots in cast order, Hamza first, whatever the file's order", () => {
    const swapped = { ...timeline, speakers: { zoya: timeline.speakers.zoya, hamza: timeline.speakers.hamza } };
    expect(Object.keys(mascotStates(swapped, 0))).toEqual(["hamza", "zoya"]);
  });
});

describe("episodeUrls", () => {
  it("puts the versioned timeline and the audio it names under the episode's folder on the audio origin", () => {
    expect(episodeUrls("articles/nooreimaan/naskh", 1)).toEqual({
      timeline: "https://audio.ishqnama.com/podcasts/articles/nooreimaan/naskh.timeline.v1.json",
      folder: "https://audio.ishqnama.com/podcasts/articles/nooreimaan/",
    });
    expect(episodeUrls("articles/nooreimaan/naskh", 12, "https://cdn.example")).toEqual({
      timeline: "https://cdn.example/podcasts/articles/nooreimaan/naskh.timeline.v12.json",
      folder: "https://cdn.example/podcasts/articles/nooreimaan/",
    });
  });

  it("refuses an episode that leaves the podcasts folder or a version that is not a counting number", () => {
    expect(() => episodeUrls("../secrets", 1)).toThrow(/episode/);
    expect(() => episodeUrls("", 1)).toThrow(/episode/);
    expect(() => episodeUrls("articles/nooreimaan/naskh.timeline.v1", 1)).toThrow(/episode/);
    expect(() => episodeUrls("articles/nooreimaan/naskh", 0)).toThrow(/version/);
    expect(() => episodeUrls("articles/nooreimaan/naskh", 1.5)).toThrow(/version/);
    expect(() => episodeUrls("articles/nooreimaan/naskh", Number.NaN)).toThrow(/version/);
  });
});

describe("reflectionEpisode", () => {
  it("reads the episode and version from a released timeline's path, wherever under /podcasts/ it is", () => {
    expect(reflectionEpisode("articles/nooreimaan/naskh.timeline.v1.json")).toEqual({ episode: "articles/nooreimaan/naskh", version: 1 });
    expect(reflectionEpisode("talks/sabr_brief.timeline.v12.json")).toEqual({ episode: "talks/sabr_brief", version: 12 });
    const { episode, version } = reflectionEpisode("articles/nooreimaan/naskh.timeline.v2.json");
    expect(episodeUrls(episode, version).timeline).toBe("https://audio.ishqnama.com/podcasts/articles/nooreimaan/naskh.timeline.v2.json");
  });

  it("refuses anything that is not a released timeline's relative path", () => {
    for (const url of [
      "articles/nooreimaan/naskh.v1.m4a",
      "articles/nooreimaan/naskh.timeline.v0.json",
      "articles/nooreimaan/naskh.timeline.json",
      "../naskh.timeline.v1.json",
      "/articles/naskh.timeline.v1.json",
      "https://audio.ishqnama.com/podcasts/naskh.timeline.v1.json",
    ]) {
      expect(() => reflectionEpisode(url), url).toThrow(/released timeline/);
    }
  });
});
