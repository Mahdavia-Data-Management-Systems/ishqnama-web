import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AudioPlayerDock from "@/components/audio/audio-player-dock";

let pathname = "/about/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

afterEach(() => {
  cleanup();
  pathname = "/about/";
});

const recording = { link: "https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5", title: "Dua for completing the Quran" };
const url = "https://open.spotify.com/episode/7makk4oTQel546B0PZlDM5";

function renderDock(props: Partial<Parameters<typeof AudioPlayerDock>[0]> = {}) {
  const hostRef = createRef<HTMLDivElement>();
  const onClose = vi.fn();
  render(
    <AudioPlayerDock
      status="starting"
      recording={recording}
      spotifyUrl={url}
      hostRef={hostRef}
      onClose={onClose}
      {...props}
    />,
  );
  return { hostRef, onClose };
}

describe("AudioPlayerDock", () => {
  it("renders nothing while closed", () => {
    renderDock({ status: "closed", recording: null, spotifyUrl: null });
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("names itself, shows the title and subtitle, and takes focus so keyboard readers find it", () => {
    renderDock({ recording: { ...recording, subtitle: "Noor e Imaan" } });
    const region = screen.getByRole("region", { name: "Recording" });
    expect(screen.getByText("Dua for completing the Quran")).toBeTruthy();
    expect(screen.getByText("Noor e Imaan")).toBeTruthy();
    expect(region.contains(document.activeElement)).toBe(true);
  });

  it("gives the embed a place to land while starting, marked as waiting", () => {
    const { hostRef } = renderDock();
    expect(hostRef.current).not.toBeNull();
    expect(hostRef.current?.dataset.state).toBe("starting");
  });

  it("keeps the embed's place once ready, no longer waiting", () => {
    const { hostRef } = renderDock({ status: "ready" });
    expect(hostRef.current?.dataset.state).toBe("ready");
  });

  it("closes from its button", () => {
    const { onClose } = renderDock({ status: "ready" });
    fireEvent.click(screen.getByRole("button", { name: "Close recording" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("explains a failure and offers Spotify's own page", () => {
    renderDock({ status: "failed" });
    expect(screen.getByText("This recording couldn't start.")).toBeTruthy();
    const link = screen.getByRole("link", { name: "Open it in Spotify" });
    expect(link.getAttribute("href")).toBe(url);
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("offers no page when the link was not Spotify's", () => {
    renderDock({ status: "failed", spotifyUrl: null });
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("sits above the reader toolbar on reader pages and above the bottom nav elsewhere", () => {
    const { unmount } = render(
      <AudioPlayerDock status="ready" recording={recording} spotifyUrl={url} hostRef={createRef()} onClose={() => {}} />,
    );
    expect(screen.getByRole("region").dataset.clears).toBe("bottom-nav");
    unmount();
    pathname = "/quran/1/";
    render(
      <AudioPlayerDock status="ready" recording={recording} spotifyUrl={url} hostRef={createRef()} onClose={() => {}} />,
    );
    expect(screen.getByRole("region").dataset.clears).toBe("toolbar");
  });
});
