import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArticleShareButton from "@/components/articles/article-share-button";

const trackEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ trackEvent: (...args: unknown[]) => trackEvent(...args) }));

function renderButton() {
  render(
    <ArticleShareButton
      path="/articles/nooreimaan/naskh/"
      title="Naskh (abrogation)"
      text={"Noor-e-Imaan | نسخ\nNaskh (abrogation)\n"}
      page="essay"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
}

describe("ArticleShareButton", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    trackEvent.mockReset();
  });

  it("hands the page's own link to the system share sheet", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { share });
    renderButton();
    await vi.waitFor(() => expect(trackEvent).toHaveBeenCalled());
    expect(share).toHaveBeenCalledWith({
      title: "Naskh (abrogation)",
      text: "Noor-e-Imaan | نسخ\nNaskh (abrogation)\n",
      url: `${window.location.origin}/articles/nooreimaan/naskh/`,
    });
    expect(trackEvent).toHaveBeenCalledWith("article-shared", { option: "essay", method: "native" });
  });

  it("copies the message and link where there is no share sheet, and says so", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    renderButton();
    expect((await screen.findByRole("status")).textContent).toBe("Link copied. Paste it wherever you like.");
    expect(writeText).toHaveBeenCalledWith(
      `Noor-e-Imaan | نسخ\nNaskh (abrogation)\n\n${window.location.origin}/articles/nooreimaan/naskh/`,
    );
  });

  it("says so when neither works", async () => {
    vi.stubGlobal("navigator", {});
    renderButton();
    expect((await screen.findByRole("status")).textContent).toBe("Couldn't share from here. Try again.");
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
