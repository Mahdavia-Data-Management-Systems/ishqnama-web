import { describe, expect, it } from "vitest";
import { RECITATION, RECITATIONS, recitationById } from "@/config/recitation";

describe("recitations", () => {
  it("offers Abdul Basit's murattal as the one reciter, and the default", () => {
    expect(RECITATIONS.map((r) => ({ id: r.timings.id, name: r.name, reciter: r.reciter }))).toEqual([
      { id: "abdul-basit-murattal", name: "Abdul Basit Abdul Samad - Murattal", reciter: "Abdul Basit Abdul Samad" },
    ]);
    expect(RECITATION).toBe(RECITATIONS[0]);
  });

  it("finds a recitation by its id and falls back to the default for an unknown one", () => {
    expect(recitationById("abdul-basit-murattal")).toBe(RECITATION);
    expect(recitationById("someone-else")).toBe(RECITATION);
    expect(recitationById(undefined)).toBe(RECITATION);
  });
});
