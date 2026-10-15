import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import MascotAvatar from "../mascot-avatar";

afterEach(cleanup);

describe("MascotAvatar", () => {
  it("shows the mascot's image for the expression, named after the mascot", () => {
    render(<MascotAvatar mascot={{ id: "zoya", name: "Zoya" }} expression="thoughtful" speaking level={0.4} />);
    const img = screen.getByRole("img", { name: "Zoya" });
    expect(img.getAttribute("src")).toBe("/images/mascots/zoya/thoughtful.webp");
  });

  it("marks the speaker and carries the voice level for the glow", () => {
    const { container } = render(<MascotAvatar mascot={{ id: "hamza", name: "Hamza" }} expression="speaking" speaking level={0.75} />);
    const figure = container.firstElementChild as HTMLElement;
    expect(figure.dataset.speaking).toBe("true");
    expect(figure.style.getPropertyValue("--voice-level")).toBe("0.75");
  });

  it("keeps a listener quiet", () => {
    const { container } = render(<MascotAvatar mascot={{ id: "hamza", name: "Hamza" }} expression="listening" speaking={false} level={0.75} />);
    const figure = container.firstElementChild as HTMLElement;
    expect(figure.dataset.speaking).toBe("false");
    expect(figure.style.getPropertyValue("--voice-level")).toBe("0");
  });
});
