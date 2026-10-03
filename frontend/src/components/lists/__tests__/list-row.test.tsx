import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import ListRow from "@/components/lists/list-row";
import { LISTS_COPY } from "@/config/lists-copy";
import type { VerseListSummaryDto } from "@/types/lists";

const list: VerseListSummaryDto = {
  id: "aaaaaaaaaaaa",
  title: "Related to Mahdi ahs",
  description: "Ayaat that speak of the Mahdi",
  ownerName: "Noor Mahdi",
  status: "draft",
  groupCount: 2,
  updatedAt: "",
};

describe("ListRow", () => {
  afterEach(cleanup);

  it("shows who compiled another reader's list", () => {
    render(<ListRow list={{ ...list, status: "published" }} />);
    expect(screen.getByText("Noor Mahdi")).toBeTruthy();
    expect(screen.queryByRole("link", { name: LISTS_COPY.edit })).toBeNull();
  });

  it("leaves my own name off my lists and offers Edit with the status instead", () => {
    render(<ListRow list={list} mine />);
    expect(screen.queryByText("Noor Mahdi")).toBeNull();
    expect(screen.getByText(LISTS_COPY.draft)).toBeTruthy();
    expect(screen.getByRole("link", { name: LISTS_COPY.edit })).toBeTruthy();
  });

  it("marks my published list as featured when it is one of the site's featured lists", () => {
    render(<ListRow list={{ ...list, status: "published" }} mine featured />);
    expect(screen.getByText(LISTS_COPY.published)).toBeTruthy();
    expect(screen.getByText(LISTS_COPY.featured)).toBeTruthy();
  });

  it("leaves the featured badge off a draft and off a list that is not featured", () => {
    render(<ListRow list={list} mine featured />);
    expect(screen.queryByText(LISTS_COPY.featured)).toBeNull();
    cleanup();
    render(<ListRow list={{ ...list, status: "published" }} mine />);
    expect(screen.queryByText(LISTS_COPY.featured)).toBeNull();
  });
});
