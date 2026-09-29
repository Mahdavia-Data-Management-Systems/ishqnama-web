import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const setPreference = vi.fn();
let theme = { preference: "system", resolved: "light", setPreference };
vi.mock("@/lib/theme", () => ({ useTheme: () => theme }));

import ThemeMenu from "@/components/navigation/theme-menu";

describe("ThemeMenu", () => {
  afterEach(cleanup);

  beforeEach(() => {
    setPreference.mockReset();
    theme = { preference: "system", resolved: "light", setPreference };
  });

  it("renders its button without any sign-in context", () => {
    render(<ThemeMenu />);
    expect(screen.getByRole("button", { name: "Appearance" })).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens to three choices with the current one checked", () => {
    render(<ThemeMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    const items = screen.getAllByRole("menuitemradio");
    expect(items.map((i) => i.textContent)).toEqual(["Light", "Dark", "Match my device"]);
    expect(items.map((i) => i.getAttribute("aria-checked"))).toEqual(["false", "false", "true"]);
  });

  it("applies a choice and closes", () => {
    render(<ThemeMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    expect(setPreference).toHaveBeenCalledWith("dark");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("moves focus to the checked item when it opens", () => {
    render(<ThemeMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Match my device" }));
  });

  it("closes on Escape pressed on the button and returns focus to it", () => {
    render(<ThemeMenu />);
    const button = screen.getByRole("button", { name: "Appearance" });
    fireEvent.click(button);
    button.focus();
    fireEvent.keyDown(button, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("closes on Escape pressed on an item", () => {
    render(<ThemeMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    fireEvent.keyDown(screen.getByRole("menuitemradio", { name: "Dark" }), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes on a click outside", () => {
    render(<div><ThemeMenu /><p>outside</p></div>);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("renders both icons for CSS to pick, so the prerendered page shows the right one", () => {
    // The server snapshot is always light, so an icon chosen in React would show the sun to a
    // dark reader until hydration. Both are rendered and globals.css shows one per data-theme.
    const { container } = render(<ThemeMenu />);
    const button = screen.getByRole("button", { name: "Appearance" });
    expect(button.querySelector('.theme-icon-light[data-icon="sun"]')).toBeTruthy();
    expect(button.querySelector('.theme-icon-dark[data-icon="moon"]')).toBeTruthy();
    expect(container.querySelectorAll("[data-icon]")).toHaveLength(2);
  });
});
