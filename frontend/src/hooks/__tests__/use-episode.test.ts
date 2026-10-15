import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEpisode } from "../use-episode";

const timeline = {
  version: 1,
  audio: "mustanifa_brief.m4a",
  durationMs: 10000,
  language: "ur",
  speakers: { zoya: { cluster: 0, medianPitchHz: 219, speechMs: 5000 } },
  turns: [{ speaker: "zoya", fromMs: 200, toMs: 4000, expression: "speaking", text: "فرض کریں" }],
};

afterEach(() => vi.unstubAllGlobals());

describe("useEpisode", () => {
  it("fetches the episode's timeline and resolves its audio beside it", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(timeline), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useEpisode("articles/nooreimaan/mustanifa_brief"));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchMock).toHaveBeenCalledWith("https://audio.ishqnama.com/podcasts/articles/nooreimaan/mustanifa_brief.timeline.json");
    expect(result.current.timeline?.turns).toHaveLength(1);
    expect(result.current.audioUrl).toBe("https://audio.ishqnama.com/podcasts/articles/nooreimaan/mustanifa_brief.m4a");
  });

  it("reports a missing or malformed episode", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
    const { result } = renderHook(() => useEpisode("articles/nooreimaan/missing"));
    await waitFor(() => expect(result.current.status).toBe("unavailable"));

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ version: 2 }), { status: 200 })));
    const { result: malformed } = renderHook(() => useEpisode("articles/nooreimaan/odd"));
    await waitFor(() => expect(malformed.current.status).toBe("unavailable"));
  });

  it("refuses an episode path that leaves the podcasts folder without fetching", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useEpisode("../elsewhere"));
    expect(result.current.status).toBe("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
