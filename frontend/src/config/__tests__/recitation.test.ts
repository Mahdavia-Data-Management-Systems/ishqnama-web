import { describe, expect, it } from "vitest";
import {
  DEFAULT_RECITATION_SPEED,
  RECITATION,
  RECITATIONS,
  RECITATION_SPEEDS,
  nearestRecitationSpeed,
  recitationById,
} from "@/config/recitation";

describe("recitations", () => {
  it("offers Mishari al-Afasy's murattal first, as the default, then Abdul Basit's", () => {
    expect(RECITATIONS.map((r) => ({ id: r.timings.id, name: r.name, reciter: r.reciter }))).toEqual([
      { id: "mishari-rashid-al-afasy-murattal", name: "Mishari Rashid al-Afasy - Murattal", reciter: "Mishari Rashid al-Afasy" },
      { id: "abdul-basit-murattal", name: "Abdul Basit Abdul Samad - Murattal", reciter: "Abdul Basit Abdul Samad" },
    ]);
    expect(RECITATION).toBe(RECITATIONS[0]);
    expect(RECITATION.timings.id).toBe("mishari-rashid-al-afasy-murattal");
  });

  it("finds a recitation by its id and falls back to the default for an unknown one", () => {
    expect(recitationById("mishari-rashid-al-afasy-murattal")).toBe(RECITATION);
    expect(recitationById("abdul-basit-murattal")).toBe(RECITATIONS[1]);
    expect(recitationById("someone-else")).toBe(RECITATION);
    expect(recitationById(undefined)).toBe(RECITATION);
  });
});

describe("recitation speeds", () => {
  it("runs from normal speed to two and a half times, normal by default", () => {
    expect(RECITATION_SPEEDS).toEqual([1, 1.2, 1.5, 1.7, 2, 2.5]);
    expect(DEFAULT_RECITATION_SPEED).toBe(1);
  });

  it("snaps a saved value to the nearest step and an unusable one to normal", () => {
    expect(nearestRecitationSpeed(1.5)).toBe(1.5);
    expect(nearestRecitationSpeed(1.55)).toBe(1.5);
    expect(nearestRecitationSpeed(1.65)).toBe(1.7);
    expect(nearestRecitationSpeed(3)).toBe(2.5);
    expect(nearestRecitationSpeed(0.5)).toBe(1);
    expect(nearestRecitationSpeed(NaN)).toBe(1);
    expect(nearestRecitationSpeed(undefined)).toBe(1);
  });
});
