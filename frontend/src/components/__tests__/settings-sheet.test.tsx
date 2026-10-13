import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsSheet from "@/components/settings-sheet";

function renderSheet(props: Partial<React.ComponentProps<typeof SettingsSheet>> = {}) {
  return render(
    <SettingsSheet
      isOpen
      onClose={vi.fn()}
      mode="verse"
      onModeChange={vi.fn()}
      lang="english"
      onLangChange={vi.fn()}
      fontScale={2}
      onFontScaleChange={vi.fn()}
      showTafseer={false}
      onTafseerChange={vi.fn()}
      showSuraRukuMarks={false}
      onSuraRukuMarksChange={vi.fn()}
      showJuzRukuMarks
      onJuzRukuMarksChange={vi.fn()}
      reciter="abdul-basit-murattal"
      onReciterChange={vi.fn()}
      continueRecitation
      onContinueRecitationChange={vi.fn()}
      {...props}
    />,
  );
}

const readerToggle = () => screen.getByRole("button", { name: "Reader settings" });
const readerPanel = () => document.getElementById(readerToggle().getAttribute("aria-controls")!)!;

describe("SettingsSheet reader section", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts collapsed", () => {
    renderSheet();
    expect(readerToggle().getAttribute("aria-expanded")).toBe("false");
    expect(readerPanel().hidden).toBe(true);
  });

  it("starts expanded when asked to", () => {
    renderSheet({ expandedSection: "reader" });
    expect(readerToggle().getAttribute("aria-expanded")).toBe("true");
    expect(readerPanel().hidden).toBe(false);
    expect(screen.getByText("Reading mode")).toBeTruthy();
  });

  it("toggles open and closed", () => {
    renderSheet();
    fireEvent.click(readerToggle());
    expect(readerToggle().getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(readerToggle());
    expect(readerToggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("applies the requested state afresh on each open", () => {
    const view = renderSheet({ expandedSection: "reader" });
    fireEvent.click(readerToggle());
    const rerender = (props: Partial<React.ComponentProps<typeof SettingsSheet>>) =>
      view.rerender(
        <SettingsSheet
          onClose={vi.fn()}
          mode="verse"
          onModeChange={vi.fn()}
          lang="english"
          onLangChange={vi.fn()}
          fontScale={2}
          onFontScaleChange={vi.fn()}
          showTafseer={false}
          onTafseerChange={vi.fn()}
          showSuraRukuMarks={false}
          onSuraRukuMarksChange={vi.fn()}
          showJuzRukuMarks
          onJuzRukuMarksChange={vi.fn()}
          reciter="abdul-basit-murattal"
          onReciterChange={vi.fn()}
          continueRecitation
          onContinueRecitationChange={vi.fn()}
          isOpen
          {...props}
        />,
      );
    rerender({ isOpen: false, expandedSection: "reader" });
    rerender({ isOpen: true, expandedSection: "reader" });
    expect(readerToggle().getAttribute("aria-expanded")).toBe("true");
    rerender({ isOpen: false, expandedSection: null });
    rerender({ isOpen: true, expandedSection: null });
    expect(readerToggle().getAttribute("aria-expanded")).toBe("false");
  });
});

const generalToggle = () => screen.getByRole("button", { name: "General settings" });

describe("SettingsSheet general section", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts collapsed, even when the reader section is asked for", () => {
    renderSheet({ expandedSection: "reader" });
    expect(generalToggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("starts expanded when asked to", () => {
    renderSheet({ expandedSection: "general" });
    expect(generalToggle().getAttribute("aria-expanded")).toBe("true");
    expect(readerToggle().getAttribute("aria-expanded")).toBe("false");
    const group = screen.getByRole("group", { name: "Show ruku marks in Quran index" });
    expect(within(group).getByRole("switch", { name: "For sura" })).toBeTruthy();
    expect(within(group).getByRole("switch", { name: "For juz" })).toBeTruthy();
  });

  it("reports each ruku mark switch toggled", () => {
    const onSuraRukuMarksChange = vi.fn();
    const onJuzRukuMarksChange = vi.fn();
    renderSheet({ expandedSection: "general", onSuraRukuMarksChange, onJuzRukuMarksChange });
    const sura = screen.getByRole("switch", { name: "For sura" });
    const juz = screen.getByRole("switch", { name: "For juz" });
    expect(sura.getAttribute("aria-checked")).toBe("false");
    expect(juz.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(sura);
    fireEvent.click(juz);
    expect(onSuraRukuMarksChange).toHaveBeenCalledWith(true);
    expect(onJuzRukuMarksChange).toHaveBeenCalledWith(false);
  });
});

const recitationToggle = () => screen.getByRole("button", { name: "Recitation settings" });

describe("SettingsSheet recitation section", () => {
  afterEach(() => {
    cleanup();
  });

  it("comes after the general and reader sections", () => {
    renderSheet();
    const names = screen.getAllByRole("button", { expanded: false }).map((b) => b.textContent);
    expect(names).toEqual(["General settings", "Reader settings", "Recitation settings"]);
  });

  it("offers the one reciter and the continue switch, on", () => {
    renderSheet({ expandedSection: "recitation" });
    expect(recitationToggle().getAttribute("aria-expanded")).toBe("true");
    const reciter = screen.getByRole("combobox", { name: "Reciter" }) as HTMLSelectElement;
    expect(Array.from(reciter.options).map((o) => o.textContent)).toEqual(["Abdul Basit Abdul Samad - Murattal"]);
    expect(reciter.value).toBe("abdul-basit-murattal");
    expect(screen.getByRole("switch", { name: "Continue to the next verse" }).getAttribute("aria-checked")).toBe("true");
  });

  it("reports the switch and the reciter changed", () => {
    const onContinueRecitationChange = vi.fn();
    const onReciterChange = vi.fn();
    renderSheet({ expandedSection: "recitation", onContinueRecitationChange, onReciterChange });
    fireEvent.click(screen.getByRole("switch", { name: "Continue to the next verse" }));
    expect(onContinueRecitationChange).toHaveBeenCalledWith(false);
    fireEvent.change(screen.getByRole("combobox", { name: "Reciter" }), { target: { value: "abdul-basit-murattal" } });
    expect(onReciterChange).toHaveBeenCalledWith("abdul-basit-murattal");
  });
});

describe("SettingsSheet sections", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps only one section expanded at a time", () => {
    renderSheet({ expandedSection: "reader" });
    fireEvent.click(generalToggle());
    expect(generalToggle().getAttribute("aria-expanded")).toBe("true");
    expect(readerToggle().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(readerToggle());
    expect(readerToggle().getAttribute("aria-expanded")).toBe("true");
    expect(generalToggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("lets the open section collapse, leaving none expanded", () => {
    renderSheet({ expandedSection: "general" });
    fireEvent.click(generalToggle());
    expect(generalToggle().getAttribute("aria-expanded")).toBe("false");
    expect(readerToggle().getAttribute("aria-expanded")).toBe("false");
  });
});
