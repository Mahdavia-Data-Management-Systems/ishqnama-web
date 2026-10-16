import { describe, expect, it } from "vitest";
import { RECITATIONS } from "@/config/recitation";
import { ABDUL_BASIT_MURATTAL } from "@/data/recitations/abdul-basit-murattal";
import { MISHARI_RASHID_AL_AFASY_MURATTAL } from "@/data/recitations/mishari-rashid-al-afasy-murattal";
import { suras } from "@/data/suras";

// Every recitation on offer, so a newly onboarded module is checked against the chapter data.
describe.each(RECITATIONS.map((r) => [r.timings.id, r.timings] as const))("%s timings", (_id, timings) => {
  it("has a row for every numbered verse of every chapter, in order", () => {
    expect(timings.chapters).toHaveLength(114);
    for (const sura of suras) {
      const rows = timings.chapters[sura.number - 1];
      expect(rows, `chapter ${sura.number}`).toHaveLength(sura.verseCount);
      rows.forEach(([verse], i) => expect(verse, `chapter ${sura.number} row ${i}`).toBe(i + 1));
    }
  });

  it("gives every verse a span that ends after it starts", () => {
    timings.chapters.forEach((rows, i) => {
      for (const [verse, from, to] of rows) expect(from, `${i + 1}:${verse}`).toBeLessThan(to);
    });
  });

  it("holds the basmala as a span at the start of chapter 1's file", () => {
    const [from, to] = timings.basmala;
    expect(from).toBe(0);
    expect(to).toBeGreaterThan(from);
    expect(timings.chapters[0][0][1]).toBeGreaterThanOrEqual(to);
  });

  it("splits al-Fatiha's last Tarteel verse into our 1:6 and 1:7", () => {
    const [, , v6to] = timings.chapters[0][5];
    const [, v7from] = timings.chapters[0][6];
    expect(v7from).toBeGreaterThanOrEqual(v6to);
    expect(v7from - v6to).toBeLessThan(1000);
  });
});

describe("recitation modules", () => {
  it("name their recitation and version", () => {
    expect(ABDUL_BASIT_MURATTAL.id).toBe("abdul-basit-murattal");
    expect(ABDUL_BASIT_MURATTAL.version).toBe(1);
    expect(MISHARI_RASHID_AL_AFASY_MURATTAL.id).toBe("mishari-rashid-al-afasy-murattal");
    expect(MISHARI_RASHID_AL_AFASY_MURATTAL.version).toBe(1);
  });
});
