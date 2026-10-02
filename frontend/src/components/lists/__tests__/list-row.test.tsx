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
    expect(screen.queryByText(LISTS_COPY.edit)).toBeNull();
  });

  it("leaves my own name off my lists and offers Edit with the status instead", () => {
    render(<ListRow list={list} mine />);
    expect(screen.queryByText("Noor Mahdi")).toBeNull();
    expect(screen.getByText(LISTS_COPY.draft)).toBeTruthy();
    expect(screen.getByText(LISTS_COPY.edit)).toBeTruthy();
  });
});
