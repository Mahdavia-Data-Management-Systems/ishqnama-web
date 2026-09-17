import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReaderSettingsProvider, {
  DEFAULT_SETTINGS,
  mergeSettings,
  useReaderSettings,
} from "@/context/reader-settings-context";
import {
  GRACE_MS,
  markProbeSettled,
  markProbeStarted,
  resetApiReadiness,
} from "@/lib/api-readiness";
import { getUserSettings, saveUserSettings } from "@/lib/user-api";
import type { UserSettingsDto } from "@/types/user";

vi.mock("@azure/msal-react", () => ({ useIsAuthenticated: () => true }));
vi.mock("@/lib/user-api", () => ({
  getUserSettings: vi.fn(),
  saveUserSettings: vi.fn(),
}));

const mockedGet = vi.mocked(getUserSettings);
const mockedSave = vi.mocked(saveUserSettings);

const SERVER: UserSettingsDto = { mode: "continuous", lang: "english", fontScale: 3, showTafseer: true };

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function wrapper({ children }: { children: ReactNode }) {
  return <ReaderSettingsProvider>{children}</ReaderSettingsProvider>;
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("mergeSettings", () => {
  it("overlays server settings with the pending patch", () => {
    expect(mergeSettings(SERVER, { fontScale: 5 })).toEqual({ ...SERVER, fontScale: 5 });
  });

  it("falls back to defaults when the server has no settings", () => {
    expect(mergeSettings(null, { mode: "continuous" })).toEqual({ ...DEFAULT_SETTINGS, mode: "continuous" });
  });

  it("returns the server settings unchanged for an empty patch", () => {
    expect(mergeSettings(SERVER, {})).toEqual(SERVER);
  });
});

describe("ReaderSettingsProvider sync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
    mockedSave.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("applies server settings when the load succeeds and sends nothing", async () => {
    mockedGet.mockResolvedValueOnce(SERVER);
    const { result } = renderHook(() => useReaderSettings(), { wrapper });
    await flush();
    expect(result.current.mode).toBe("continuous");
    expect(result.current.fontScale).toBe(3);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("keeps a change made before the settings arrived and saves the merged result once", async () => {
    const load = deferred<UserSettingsDto | null>();
    mockedGet.mockReturnValueOnce(load.promise);
    const { result } = renderHook(() => useReaderSettings(), { wrapper });

    act(() => result.current.updateSettings({ fontScale: 5 }));
    expect(result.current.fontScale).toBe(5);
    expect(mockedSave).not.toHaveBeenCalled();

    await act(async () => {
      load.resolve(SERVER);
      await load.promise;
    });
    await flush();

    expect(result.current.mode).toBe("continuous");
    expect(result.current.fontScale).toBe(5);
    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(mockedSave).toHaveBeenCalledWith({ ...SERVER, fontScale: 5 });
  });

  it("does not overwrite server settings with defaults after a failed load", async () => {
    mockedGet.mockRejectedValueOnce(new Error("network"));
    mockedGet.mockResolvedValueOnce(SERVER);
    const { result } = renderHook(() => useReaderSettings(), { wrapper });
    await flush();

    act(() => result.current.updateSettings({ showTafseer: false }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mockedSave).not.toHaveBeenCalled();

    act(() => markProbeSettled(true));
    await flush();

    expect(mockedGet).toHaveBeenCalledTimes(2);
    expect(result.current.mode).toBe("continuous");
    expect(result.current.showTafseer).toBe(false);
    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(mockedSave).toHaveBeenCalledWith({ ...SERVER, showTafseer: false });
  });

  it("queues saves while warming and sends one PUT of the latest value on ready", async () => {
    mockedGet.mockResolvedValueOnce(SERVER);
    const { result } = renderHook(() => useReaderSettings(), { wrapper });
    await flush();

    act(() => {
      markProbeStarted();
      vi.advanceTimersByTime(GRACE_MS);
    });

    act(() => result.current.updateSettings({ fontScale: 1 }));
    act(() => result.current.updateSettings({ fontScale: 2 }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(mockedSave).not.toHaveBeenCalled();

    act(() => markProbeSettled(true));
    await flush();
    expect(mockedSave).toHaveBeenCalledTimes(1);
    expect(mockedSave).toHaveBeenCalledWith({ ...SERVER, fontScale: 2 });
  });

  it("debounces and sends immediately when ready, and retries a failed PUT on the next ready", async () => {
    mockedGet.mockResolvedValueOnce(SERVER);
    const { result } = renderHook(() => useReaderSettings(), { wrapper });
    await flush();
    act(() => {
      markProbeStarted();
      markProbeSettled(true);
    });

    mockedSave.mockRejectedValueOnce(new Error("network"));
    act(() => result.current.updateSettings({ lang: "hindi" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(mockedSave).toHaveBeenCalledTimes(1);

    act(() => markProbeSettled(true));
    await flush();
    expect(mockedSave).toHaveBeenCalledTimes(2);
    expect(mockedSave).toHaveBeenLastCalledWith({ ...SERVER, lang: "hindi" });
  });
});
