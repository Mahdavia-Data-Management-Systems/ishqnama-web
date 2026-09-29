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

  it("closes on Escape and returns focus to the button", () => {
    render(<ThemeMenu />);
    const button = screen.getByRole("button", { name: "Appearance" });
    fireEvent.click(button);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it("closes on a click outside", () => {
    render(<div><ThemeMenu /><p>outside</p></div>);
    fireEvent.click(screen.getByRole("button", { name: "Appearance" }));
    fireEvent.mouseDown(screen.getByText("outside"));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("shows the icon of the theme on screen", () => {
    const { container, rerender } = render(<ThemeMenu />);
    expect(container.querySelector('[data-icon="sun"]')).toBeTruthy();
    theme = { ...theme, resolved: "dark" };
    rerender(<ThemeMenu />);
    expect(container.querySelector('[data-icon="moon"]')).toBeTruthy();
  });
});
