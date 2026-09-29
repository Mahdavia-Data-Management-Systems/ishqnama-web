import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.resolve(__dirname, "../globals.css"), "utf8");

/** The custom properties declared directly in the first block whose selector matches. */
function block(selector: RegExp): Map<string, string> {
  const match = selector.exec(css);
  if (!match) throw new Error(`no block for ${selector}`);
  const body = css.slice(match.index + match[0].length, css.indexOf("}", match.index));
  const props = new Map<string, string>();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) props.set(m[1], m[2].trim());
  return props;
}

const COLOUR = /#[0-9a-f]{3,8}\b|rgba?\(/i;

// Tokens that are the same in both themes by design (text on the always-dark chrome, gold, ornaments).
const THEME_INDEPENDENT = new Set([
  "--text-on-dark",
  "--text-on-dark-muted",
  "--text-on-dark-subtle",
  "--gold",
  "--gold-bright",
  "--gradient-splash",
  "--ornament-gold",
  "--ornament-gold-strong",
]);

describe("theme tokens", () => {
  const light = block(/:root\s*\{/);
  const dark = block(/:root\[data-theme="dark"\]\s*\{/);

  it("gives every light colour token a dark value", () => {
    const missing = [...light]
      .filter(([name, value]) => COLOUR.test(value) && !THEME_INDEPENDENT.has(name))
      .map(([name]) => name)
      .filter((name) => !dark.has(name));
    expect(missing).toEqual([]);
  });

  it("defines no dark token that light lacks", () => {
    expect([...dark.keys()].filter((name) => !light.has(name))).toEqual([]);
  });

  it("scopes the dark block to screens so printing stays light", () => {
    expect(css).toMatch(/@media screen\s*\{\s*:root\[data-theme="dark"\]/);
  });

  it("defines the tokens components rely on", () => {
    for (const name of [
      "--fill-primary", "--fill-primary-hover", "--fill-primary-press",
      "--fill-danger", "--fill-danger-hover", "--color-error", "--color-surface-hover",
      "--surface-raised", "--badge-madani-bg", "--book-glow", "--ribbon-shadow",
      "--tint-teal-3", "--tint-teal-20", "--tint-ink-6", "--tint-ink-20",
    ]) {
      expect(light.has(name), name).toBe(true);
    }
  });
});
