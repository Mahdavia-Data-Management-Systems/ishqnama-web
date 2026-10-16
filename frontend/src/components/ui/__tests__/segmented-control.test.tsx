import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SegmentedControl from "@/components/ui/segmented-control";

const options = [
  { label: "English", value: "english", shortLabel: "En", ariaLabel: "English" },
  { label: "Verse by verse", value: "verse", icon: <span>i</span>, ariaLabel: "Verse by verse" },
  { label: "Continuous", value: "continuous" },
];

afterEach(cleanup);

describe("SegmentedControl", () => {
  it("shows the full label at every width by default", () => {
    render(<SegmentedControl options={options} value="english" onChange={() => {}} />);
    expect(screen.getByRole("tablist").hasAttribute("data-collapse")).toBe(false);
  });

  it("marks the wrapper when asked to collapse to icons and short labels on small screens", () => {
    render(<SegmentedControl options={options} value="english" onChange={() => {}} collapseBelow="sm" />);
    expect(screen.getByRole("tablist").getAttribute("data-collapse")).toBe("sm");
  });

  it("marks only the buttons that have a compact form to fall back to", () => {
    render(<SegmentedControl options={options} value="english" onChange={() => {}} collapseBelow="sm" />);
    expect(screen.getByRole("tab", { name: "English" }).hasAttribute("data-seg-compact")).toBe(true);
    expect(screen.getByRole("tab", { name: "Verse by verse" }).hasAttribute("data-seg-compact")).toBe(true);
    expect(screen.getByRole("tab", { name: "Continuous" }).hasAttribute("data-seg-compact")).toBe(false);
  });

  it("keeps the aria-labels so a reader hears the full name when only the short form shows", () => {
    render(<SegmentedControl options={options} value="english" onChange={() => {}} collapseBelow="sm" />);
    expect(screen.getByRole("tab", { name: "English" }).getAttribute("aria-label")).toBe("English");
  });
});
