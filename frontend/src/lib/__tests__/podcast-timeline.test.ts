import { describe, expect, it } from "vitest";
import { episodeUrls, mascotStates, parseTimeline, turnAt, type PodcastTimeline } from "../podcast-timeline";

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
  it("puts the timeline and the audio it names under the episode's folder on the audio origin", () => {
    expect(episodeUrls("articles/nooreimaan/mustanifa_brief")).toEqual({
      timeline: "https://audio.ishqnama.com/podcasts/articles/nooreimaan/mustanifa_brief.timeline.json",
      folder: "https://audio.ishqnama.com/podcasts/articles/nooreimaan/",
    });
    expect(episodeUrls("articles/nooreimaan/mustanifa_brief", "https://cdn.example")).toEqual({
      timeline: "https://cdn.example/podcasts/articles/nooreimaan/mustanifa_brief.timeline.json",
      folder: "https://cdn.example/podcasts/articles/nooreimaan/",
    });
  });

  it("refuses an episode that leaves the podcasts folder", () => {
    expect(() => episodeUrls("../secrets")).toThrow(/episode/);
    expect(() => episodeUrls("")).toThrow(/episode/);
  });
});
