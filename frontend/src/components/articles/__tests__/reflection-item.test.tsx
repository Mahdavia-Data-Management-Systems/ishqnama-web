import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ReflectionItem from "@/components/articles/reflection-item";

describe("ReflectionItem", () => {
  afterEach(cleanup);

  it("names the recording by its caption and shows its description", () => {
    render(
      <ul>
        <ReflectionItem
          reflection={{ title: "نسخ", caption: "Naskh, discussed at length", description: "Hamza and Zoya begin…", url: "articles/nooreimaan/naskh_detail.timeline.v1.json" }}
        />
      </ul>,
    );
    expect(screen.getByRole("listitem")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Naskh, discussed at length" })).toBeTruthy();
    expect(screen.getByText("Hamza and Zoya begin…")).toBeTruthy();
  });

  it("falls back to the title without a caption, and leaves out a missing description", () => {
    render(
      <ul>
        <ReflectionItem reflection={{ title: "نسخ", url: "articles/nooreimaan/naskh.timeline.v1.json" }} />
      </ul>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "نسخ" })).toBeTruthy();
    expect(screen.queryByRole("paragraph")).toBeNull();
  });
});
