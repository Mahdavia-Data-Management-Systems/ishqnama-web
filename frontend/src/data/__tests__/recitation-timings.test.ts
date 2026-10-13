import { describe, expect, it } from "vitest";
import { ABDUL_BASIT_MURATTAL } from "@/data/recitations/abdul-basit-murattal";
import { suras } from "@/data/suras";

describe("Abdul Basit murattal timings", () => {
  it("has a row for every numbered verse of every chapter, in order", () => {
    expect(ABDUL_BASIT_MURATTAL.chapters).toHaveLength(114);
    for (const sura of suras) {
      const rows = ABDUL_BASIT_MURATTAL.chapters[sura.number - 1];
      expect(rows, `chapter ${sura.number}`).toHaveLength(sura.verseCount);
      rows.forEach(([verse], i) => expect(verse, `chapter ${sura.number} row ${i}`).toBe(i + 1));
    }
  });

  it("gives every verse a span that ends after it starts", () => {
    ABDUL_BASIT_MURATTAL.chapters.forEach((rows, i) => {
      for (const [verse, from, to] of rows) expect(from, `${i + 1}:${verse}`).toBeLessThan(to);
    });
  });

  it("holds the basmala as a span at the start of chapter 1's file", () => {
    const [from, to] = ABDUL_BASIT_MURATTAL.basmala;
    expect(from).toBe(0);
    expect(to).toBeGreaterThan(from);
    expect(ABDUL_BASIT_MURATTAL.chapters[0][0][1]).toBeGreaterThanOrEqual(to);
  });

  it("splits al-Fatiha's last Tarteel verse into our 1:6 and 1:7", () => {
    const [, , v6to] = ABDUL_BASIT_MURATTAL.chapters[0][5];
    const [, v7from] = ABDUL_BASIT_MURATTAL.chapters[0][6];
    expect(v7from).toBeGreaterThanOrEqual(v6to);
    expect(v7from - v6to).toBeLessThan(1000);
  });

  it("names the recitation and its version", () => {
    expect(ABDUL_BASIT_MURATTAL.id).toBe("abdul-basit-murattal");
    expect(ABDUL_BASIT_MURATTAL.version).toBe(1);
  });
});
