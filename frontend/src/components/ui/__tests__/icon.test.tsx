import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Icon from "@/components/ui/icon";

afterEach(cleanup);

describe("Icon", () => {
  it("draws a solid play glyph and an outlined pause glyph", () => {
    const play = render(<Icon name="play" />).container.querySelector("svg");
    expect(play).not.toBeNull();
    expect(play?.getAttribute("fill")).toBe("currentColor");

    const pause = render(<Icon name="pause" />).container.querySelector("svg");
    expect(pause).not.toBeNull();
    expect(pause?.getAttribute("fill")).toBe("none");
  });

  it("draws nothing for a name it does not know", () => {
    expect(render(<Icon name="no-such-icon" />).container.querySelector("svg")).toBeNull();
  });
});
