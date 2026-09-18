import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canRenderBook } from "@/lib/book-model-support";

type NavigatorExtras = Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };

function stubMatchMedia(reducedMotion: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("canRenderBook", () => {
  const nav = navigator as NavigatorExtras;

  beforeEach(() => {
    stubMatchMedia(false);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      getExtension: () => null,
    } as unknown as WebGL2RenderingContext);
    delete nav.connection;
    delete nav.deviceMemory;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete nav.connection;
    delete nav.deviceMemory;
  });

  it("is true on a capable browser", () => {
    expect(canRenderBook()).toBe(true);
  });

  it("is false when the reader prefers reduced motion", () => {
    stubMatchMedia(true);
    expect(canRenderBook()).toBe(false);
  });

  it("is false when the reader asked to save data", () => {
    nav.connection = { saveData: true };
    expect(canRenderBook()).toBe(false);
  });

  it("is false on a device reporting under 2 GB of memory", () => {
    nav.deviceMemory = 1;
    expect(canRenderBook()).toBe(false);
  });

  it("ignores deviceMemory when the browser does not report it", () => {
    nav.deviceMemory = undefined;
    expect(canRenderBook()).toBe(true);
  });

  it("is false when no WebGL 2 context can be created", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(canRenderBook()).toBe(false);
  });

  it("is false when creating the context throws", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(canRenderBook()).toBe(false);
  });
});
