import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../..");

// Theme-independent literals: white tints on the always-dark chrome, black for shadows and
// masks, and gold tints, which read the same on both themes.
const ALLOWED = [
  /^rgba\(255, 255, 255, [\d.]+\)$/,
  /^rgba\(0, 0, 0, [\d.]+\)$/,
  /^#000$/,
  /^rgba\(190, 170, 48, [\d.]+\)$/,
  /^rgba\(247, 228, 151, [\d.]+\)$/,
];

function files(ext: string): string[] {
  return (readdirSync(SRC, { recursive: true }) as string[])
    .filter((f) => f.endsWith(ext) && !f.includes("__tests__"))
    .map((f) => path.join(SRC, f));
}

function offenders(file: string, pattern: RegExp): string[] {
  const text = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return [...text.matchAll(pattern)]
    .map((m) => m[0].replace(/\s+/g, " ").replace(/\(\s*/g, "(").replace(/,\s*/g, ", "))
    .filter((literal) => !ALLOWED.some((ok) => ok.test(literal)))
    .map((literal) => `${path.relative(SRC, file)}: ${literal}`);
}

describe("colours come from theme tokens", () => {
  it("CSS modules use no raw theme-dependent colours", () => {
    const found = files(".module.css").flatMap((f) => offenders(f, /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g));
    expect(found).toEqual([]);
  });

  it("inline styles in components use no raw rgba colours", () => {
    // Only rgb(a) here: "#1757" in TSX is an HTML entity, not a colour.
    const found = files(".tsx").flatMap((f) => offenders(f, /rgba?\([^)]*\)/g));
    expect(found).toEqual([]);
  });
});
