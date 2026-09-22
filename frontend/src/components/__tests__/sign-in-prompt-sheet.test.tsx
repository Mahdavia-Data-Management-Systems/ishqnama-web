import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignInPromptSheet from "@/components/sign-in-prompt-sheet";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";

function renderSheet(props: Partial<React.ComponentProps<typeof SignInPromptSheet>> = {}) {
  const onSignIn = vi.fn();
  const onClose = vi.fn();
  const view = render(
    <SignInPromptSheet isOpen feature="bookmark" onSignIn={onSignIn} onClose={onClose} {...props} />,
  );
  return { onSignIn, onClose, view };
}

describe("SignInPromptSheet", () => {
  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  it("is a labelled modal dialog showing the feature's title and body", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog", { name: SIGN_IN_COPY.bookmark.title });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByText(SIGN_IN_COPY.bookmark.body)).toBeTruthy();
    expect(screen.getByText(/Mahdavia Data Management System/)).toBeTruthy();
  });

  it("shows the copy of whichever feature it is opened for", () => {
    renderSheet({ feature: "search" });
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.search.title })).toBeTruthy();
  });

  it("calls onSignIn from the primary button", () => {
    const { onSignIn, onClose } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes from Not now, the close button, Escape and the backdrop", () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByTestId("sign-in-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it("does not close when the sheet body itself is clicked", () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("moves focus into the dialog and back out when it closes", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { view } = renderSheet();
    expect(document.activeElement).toBe(screen.getByRole("dialog"));
    view.rerender(<SignInPromptSheet isOpen={false} feature="bookmark" onSignIn={() => {}} onClose={() => {}} />);
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("locks body scroll while open and releases it on close", () => {
    const { view } = renderSheet();
    expect(document.body.style.overflow).toBe("hidden");
    view.rerender(<SignInPromptSheet isOpen={false} feature="bookmark" onSignIn={() => {}} onClose={() => {}} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("renders nothing when closed or without a feature", () => {
    renderSheet({ isOpen: false });
    expect(screen.queryByRole("dialog")).toBeNull();
    cleanup();
    renderSheet({ feature: null });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
