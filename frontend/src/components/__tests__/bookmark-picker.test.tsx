import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BookmarkPicker from "@/components/bookmark-picker";
import type { UserBookmarkDto } from "@/types/user";

const nazra = {
  slug: "nazra",
  title: "Nazra",
  icon: "bookmark",
  chapterNumber: 2,
  verseNumber: 5,
  isDefault: true,
  updatedAt: "2026-09-01T00:00:00Z",
} as UserBookmarkDto;

function renderPicker() {
  const props = { onClose: vi.fn(), onSelect: vi.fn(), onCreateNew: vi.fn() };
  render(<BookmarkPicker isOpen bookmarks={[nazra]} {...props} />);
  return props;
}

describe("BookmarkPicker", () => {
  afterEach(cleanup);

  it("offers the only bookmark and a new bookmark", () => {
    renderPicker();
    expect(screen.getByRole("button", { name: /Nazra/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "New bookmark" })).toBeTruthy();
  });

  it("saves to the chosen bookmark", () => {
    const { onClose, onSelect, onCreateNew } = renderPicker();
    fireEvent.click(screen.getByRole("button", { name: /Nazra/ }));
    expect(onSelect).toHaveBeenCalledWith("nazra");
    expect(onClose).toHaveBeenCalled();
    expect(onCreateNew).not.toHaveBeenCalled();
  });

  it("hands off to creating a new bookmark", () => {
    const { onClose, onSelect, onCreateNew } = renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "New bookmark" }));
    expect(onCreateNew).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
