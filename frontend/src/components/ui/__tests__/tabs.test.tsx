import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import Tabs from "@/components/ui/tabs";

const options = [
  { label: "Bookmarks", value: "bookmarks" },
  { label: "History", value: "history" },
];

function Harness() {
  const [value, setValue] = useState("bookmarks");
  return (
    <Tabs options={options} value={value} onChange={setValue} label="Saved">
      <p>{value} content</p>
    </Tabs>
  );
}

afterEach(cleanup);

describe("Tabs", () => {
  it("names the tab list and links the selected tab to its panel", () => {
    render(<Harness />);
    expect(screen.getByRole("tablist", { name: "Saved" })).toBeTruthy();
    const tab = screen.getByRole("tab", { name: "Bookmarks" });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    const panel = screen.getByRole("tabpanel", { name: "Bookmarks" });
    expect(tab.getAttribute("aria-controls")).toBe(panel.id);
    expect(panel.textContent).toBe("bookmarks content");
  });

  it("selects a tab on click", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    expect(screen.getByRole("tab", { name: "History" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("history content");
  });

  it("keeps only the selected tab in the tab order", () => {
    render(<Harness />);
    expect(screen.getByRole("tab", { name: "Bookmarks" }).tabIndex).toBe(0);
    expect(screen.getByRole("tab", { name: "History" }).tabIndex).toBe(-1);
  });

  it("moves selection and focus with arrow keys, wrapping at the ends, and Home/End", () => {
    render(<Harness />);
    const bookmarks = screen.getByRole("tab", { name: "Bookmarks" });
    const history = screen.getByRole("tab", { name: "History" });

    fireEvent.keyDown(bookmarks, { key: "ArrowRight" });
    expect(history.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(history);

    fireEvent.keyDown(history, { key: "ArrowRight" });
    expect(bookmarks.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(bookmarks, { key: "ArrowLeft" });
    expect(history.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(history, { key: "Home" });
    expect(bookmarks.getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(bookmarks, { key: "End" });
    expect(history.getAttribute("aria-selected")).toBe("true");
  });
});
