import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Icon from "@/components/ui/icon";

afterEach(cleanup);

describe("Icon", () => {
  it("draws a solid play glyph and outlined transport glyphs", () => {
    const play = render(<Icon name="play" />).container.querySelector("svg");
    expect(play?.getAttribute("fill")).toBe("currentColor");
    for (const name of ["pause", "skipBack", "skipForward"]) {
      const svg = render(<Icon name={name} />).container.querySelector("svg");
      expect(svg, name).not.toBeNull();
      expect(svg?.getAttribute("fill"), name).toBe("none");
    }
  });

  it("draws nothing for a name it does not know", () => {
    expect(render(<Icon name="no-such-icon" />).container.querySelector("svg")).toBeNull();
  });
});
