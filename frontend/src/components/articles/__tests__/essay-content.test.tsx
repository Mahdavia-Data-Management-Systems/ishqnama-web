import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EssayContent from "@/components/articles/essay-content";
import { ESSAY_FAILED_MESSAGE, ESSAY_LOADING_MESSAGE, WARMING_MESSAGE } from "@/config/readiness-copy";

const state = vi.hoisted(() => ({
  essay: null as null | { slug: string; urduTitle: string; blocks: unknown[] },
  failed: false,
  retry: vi.fn(),
  readiness: "ready",
}));
vi.mock("@/hooks/use-essay", () => ({
  useEssay: () => ({ essay: state.essay, failed: state.failed, retry: state.retry }),
}));
vi.mock("@/lib/api-readiness", () => ({ useApiReadiness: () => state.readiness }));

describe("EssayContent", () => {
  beforeEach(() => {
    state.essay = null;
    state.failed = false;
    state.readiness = "ready";
  });
  afterEach(cleanup);

  it("says the essay is opening while it loads", () => {
    render(<EssayContent slug="naskh" />);
    expect(screen.getByText(ESSAY_LOADING_MESSAGE)).toBeTruthy();
  });

  it("explains the wait during a cold start, even after a failed attempt", () => {
    state.readiness = "warming";
    state.failed = true;
    render(<EssayContent slug="naskh" />);
    expect(screen.getByText(WARMING_MESSAGE)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers to try again after a failure while ready", () => {
    state.failed = true;
    render(<EssayContent slug="naskh" />);
    expect(screen.getByText(ESSAY_FAILED_MESSAGE)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.retry).toHaveBeenCalled();
  });

  it("shows the essay once it arrives", () => {
    state.essay = { slug: "naskh", urduTitle: "نسخ", blocks: [{ type: "p", runs: [{ kind: "urdu", text: "متن" }] }] };
    render(<EssayContent slug="naskh" />);
    expect(screen.getByText("متن")).toBeTruthy();
  });
});
