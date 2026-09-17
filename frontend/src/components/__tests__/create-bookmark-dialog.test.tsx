import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateBookmarkDialog from "@/components/create-bookmark-dialog";
import {
  CREATE_BOOKMARK_HELPER,
  CREATE_BOOKMARK_TIMEOUT_ERROR,
  CREATE_BOOKMARK_WAITING_LABEL,
} from "@/config/readiness-copy";
import { GRACE_MS, markProbeStarted, resetApiReadiness } from "@/lib/api-readiness";
import { bookmarkIcons } from "@/config/bookmark-icons";

function fillForm() {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Daily" } });
  fireEvent.click(screen.getByRole("button", { name: bookmarkIcons[0].label }));
}

describe("CreateBookmarkDialog during a cold start", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetApiReadiness();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("shows no helper line while the API state is unknown", () => {
    render(<CreateBookmarkDialog isOpen onClose={() => {}} onCreate={() => Promise.resolve()} />);
    expect(screen.queryByText(CREATE_BOOKMARK_HELPER)).toBeNull();
  });

  it("shows the helper line and a waiting label while warming", async () => {
    let resolveCreate!: () => void;
    const onCreate = vi.fn(() => new Promise<void>((res) => { resolveCreate = res; }));
    render(<CreateBookmarkDialog isOpen onClose={() => {}} onCreate={onCreate} />);
    act(() => {
      markProbeStarted();
      vi.advanceTimersByTime(GRACE_MS);
    });
    expect(screen.getByText(CREATE_BOOKMARK_HELPER)).toBeTruthy();

    fillForm();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(screen.getByRole("button", { name: CREATE_BOOKMARK_WAITING_LABEL })).toBeTruthy();
    // The close button stays enabled while saving.
    expect((screen.getByRole("button", { name: "Close" }) as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      resolveCreate();
    });
  });

  it("explains a timed-out create in friendly words", async () => {
    const onCreate = vi.fn(() => Promise.reject(new DOMException("Aborted", "AbortError")));
    render(<CreateBookmarkDialog isOpen onClose={() => {}} onCreate={onCreate} />);
    fillForm();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create" }));
    });
    expect(screen.getByText(CREATE_BOOKMARK_TIMEOUT_ERROR)).toBeTruthy();
  });
});
