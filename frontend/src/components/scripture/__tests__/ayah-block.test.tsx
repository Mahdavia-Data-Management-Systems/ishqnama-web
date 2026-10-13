import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AyahBlock from "@/components/scripture/ayah-block";
import styles from "@/components/scripture/ayah-block.module.css";

afterEach(cleanup);

function renderBlock(props: Partial<React.ComponentProps<typeof AyahBlock>> = {}) {
  return render(<AyahBlock chapterNumber={2} number={255} arabic="ٱللَّهُ" activeLang="english" {...props} />);
}

describe("AyahBlock recitation control", () => {
  it("offers Play recitation first among the actions and hands over the button", () => {
    const onPlay = vi.fn();
    renderBlock({ onPlay });
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].getAttribute("aria-label")).toBe("Play recitation");
    fireEvent.click(buttons[0]);
    expect(onPlay).toHaveBeenCalledWith(buttons[0]);
  });

  it("shows Pause, pressed, and the reading wash while this verse is being read", () => {
    renderBlock({ onPlay: () => {}, isReading: true });
    const button = screen.getByRole("button", { name: "Pause" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(document.getElementById("verse-2-255")?.classList.contains(styles.reading)).toBe(true);
  });

  it("offers Play recitation again, still pressed and washed, while this verse is paused", () => {
    renderBlock({ onPlay: () => {}, isReading: true, isPaused: true });
    const button = screen.getByRole("button", { name: "Play recitation" });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
    expect(document.getElementById("verse-2-255")?.classList.contains(styles.reading)).toBe(true);
  });
});
