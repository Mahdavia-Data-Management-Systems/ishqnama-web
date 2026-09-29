import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ThemedLogo from "@/components/themed-logo";

describe("ThemedLogo", () => {
  afterEach(cleanup);

  it("renders the teal logo for light and the gold one for dark", () => {
    const { container } = render(<ThemedLogo alt="Ishqnama" width={32} height={27} className="x" />);
    const [light, dark] = [...container.querySelectorAll("img")];
    expect(light.getAttribute("src")).toBe("/logo-ishqnama.svg");
    expect(light.classList.contains("logo-light")).toBe(true);
    expect(dark.getAttribute("src")).toBe("/logo-ishqnama-gold.svg");
    expect(dark.classList.contains("logo-dark")).toBe(true);
    for (const img of [light, dark]) {
      expect(img.classList.contains("x")).toBe(true);
      expect(img.getAttribute("width")).toBe("32");
    }
  });

  it("gives only one of the pair an accessible name", () => {
    const { container } = render(<ThemedLogo alt="Ishqnama" />);
    const [light, dark] = [...container.querySelectorAll("img")];
    expect(light.getAttribute("alt")).toBe("Ishqnama");
    expect(dark.getAttribute("alt")).toBe("");
    expect(dark.getAttribute("aria-hidden")).toBe("true");
  });
});
