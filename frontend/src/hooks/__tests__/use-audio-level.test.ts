import { describe, expect, it } from "vitest";
import { glowLevel, rmsLevel, smoothLevel } from "../use-audio-level";

describe("rmsLevel", () => {
  it("is zero for silence, which the analyser gives as bytes at the centre", () => {
    expect(rmsLevel(new Uint8Array(64).fill(128))).toBe(0);
  });

  it("is one for a full-scale sine and half for one at half amplitude", () => {
    const sine = (amplitude: number) =>
      Uint8Array.from({ length: 256 }, (_, i) => Math.round(128 + amplitude * Math.sin((2 * Math.PI * i) / 64)));
    expect(rmsLevel(sine(127))).toBeCloseTo(1, 1);
    expect(rmsLevel(sine(64))).toBeCloseTo(0.5, 1);
  });

  it("is zero for no samples", () => {
    expect(rmsLevel(new Uint8Array(0))).toBe(0);
  });
});

describe("smoothLevel", () => {
  it("rises at once and falls gradually, so the glow flares on a syllable and fades after it", () => {
    expect(smoothLevel(0.1, 0.8)).toBe(0.8);
    const fallen = smoothLevel(0.8, 0.1);
    expect(fallen).toBeLessThan(0.8);
    expect(fallen).toBeGreaterThan(0.1);
  });
});

describe("glowLevel", () => {
  it("lifts ordinary speech, which measures around a tenth of full scale, to a visible glow", () => {
    expect(glowLevel(0)).toBe(0);
    expect(glowLevel(0.1)).toBeGreaterThan(0.4);
    expect(glowLevel(0.1)).toBeLessThan(0.6);
    expect(glowLevel(0.2)).toBeGreaterThan(glowLevel(0.1));
    expect(glowLevel(1)).toBe(1);
    expect(glowLevel(0.6)).toBe(1);
  });
});
