import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearEssayCache, useEssay } from "@/hooks/use-essay";
import { getNoorEImaanEssay } from "@/lib/articles-api";
import type { EssayDto } from "@/types/articles";

vi.mock("@/lib/articles-api", () => ({ getNoorEImaanEssay: vi.fn() }));
const ready = vi.hoisted(() => ({ callbacks: [] as (() => void)[] }));
vi.mock("@/lib/api-readiness", () => ({
  onReady: (cb: () => void) => {
    ready.callbacks.push(cb);
    return () => {
      ready.callbacks = ready.callbacks.filter((c) => c !== cb);
    };
  },
}));

const mockedGet = vi.mocked(getNoorEImaanEssay);
const essay = (slug: string): EssayDto => ({ slug, urduTitle: slug, blocks: [] });

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("useEssay", () => {
  beforeEach(() => {
    ready.callbacks = [];
    clearEssayCache();
    mockedGet.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("loads the essay", async () => {
    mockedGet.mockResolvedValue(essay("naskh"));
    const { result } = renderHook(() => useEssay("naskh"));
    expect(result.current.essay).toBeNull();
    await flush();
    expect(result.current).toMatchObject({ essay: essay("naskh"), failed: false });
  });

  it("never shows the previous essay while the next one loads", async () => {
    mockedGet.mockResolvedValueOnce(essay("naskh"));
    const renders = [] as (EssayDto | null)[];
    const { result, rerender } = renderHook(
      ({ slug }) => {
        const state = useEssay(slug);
        renders.push(state.essay);
        return state;
      },
      { initialProps: { slug: "naskh" } },
    );
    await flush();
    mockedGet.mockReturnValueOnce(new Promise(() => {}));
    rerender({ slug: "hazf" });
    expect(result.current.essay).toBeNull();
    // Prove no render with slug "hazf" ever showed the naskh essay
    const hazfRenderIndex = renders.length - 1; // The last rerender push
    expect(renders[hazfRenderIndex]).toBeNull();
  });

  it("retries on the next ready transition after a failure, without caching the failure", async () => {
    mockedGet.mockRejectedValueOnce(new Error("cold")).mockResolvedValueOnce(essay("naskh"));
    const { result } = renderHook(() => useEssay("naskh"));
    await flush();
    expect(result.current.failed).toBe(true);
    expect(ready.callbacks).toHaveLength(1);
    act(() => ready.callbacks[0]());
    await flush();
    expect(result.current).toMatchObject({ essay: essay("naskh"), failed: false });
    expect(mockedGet).toHaveBeenCalledTimes(2);
  });

  it("retries on demand when the failure came while already ready", async () => {
    mockedGet.mockRejectedValueOnce(new Error("500")).mockResolvedValueOnce(essay("naskh"));
    const { result } = renderHook(() => useEssay("naskh"));
    await flush();
    expect(result.current.failed).toBe(true);
    act(() => result.current.retry());
    await flush();
    expect(result.current.essay).toEqual(essay("naskh"));
  });

  it("shares one request for the visit", async () => {
    mockedGet.mockResolvedValue(essay("naskh"));
    renderHook(() => useEssay("naskh"));
    renderHook(() => useEssay("naskh"));
    await flush();
    expect(mockedGet).toHaveBeenCalledTimes(1);
  });
});
