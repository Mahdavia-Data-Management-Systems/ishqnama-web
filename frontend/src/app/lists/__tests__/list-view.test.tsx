import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ListView from "@/app/lists/view/list-view";
import ListsProvider from "@/context/lists-context";
import SignInPromptProvider from "@/context/sign-in-prompt-context";
import { LISTS_COPY } from "@/config/lists-copy";
import { SIGN_IN_COPY } from "@/config/sign-in-copy";
import { ApiError } from "@/lib/api-client";
import { clearArabicVersesCache } from "@/hooks/use-arabic-verses";
import { getChapterArabic, getFavorites, getMyLists, getPublishedList, saveListFavorite } from "@/lib/lists-api";
import type { ArabicVerseDto, VerseListDto } from "@/types/lists";

const msal = vi.hoisted(() => ({ authed: false }));
const query = vi.hoisted(() => ({ id: "k3Jd9QxP2mWa" }));

vi.mock("@azure/msal-react", () => ({
  useIsAuthenticated: () => msal.authed,
  useMsal: () => ({ instance: { loginRedirect: vi.fn().mockResolvedValue(undefined) }, inProgress: "none" }),
}));
vi.mock("@azure/msal-browser", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@azure/msal-browser")>()),
  InteractionStatus: { None: "none" },
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(`id=${query.id}`),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/context/reader-settings-context", () => ({
  useReaderSettings: () => ({ lang: "english", fontScale: 2 }),
}));
vi.mock("@/lib/lists-api", () => ({
  getPublishedList: vi.fn(),
  getChapterArabic: vi.fn(),
  getMyLists: vi.fn(),
  getFavorites: vi.fn(),
  saveListFavorite: vi.fn(),
  deleteFavorite: vi.fn(),
  createList: vi.fn(),
  appendListGroup: vi.fn(),
}));

function verses(from: number, to: number): ArabicVerseDto[] {
  return Array.from({ length: to - from + 1 }, (_, i) => ({
    verseNumber: from + i,
    arabicText: `آية ${from + i}`,
    hasSajdah: false,
  }));
}

function list(overrides: Partial<VerseListDto> = {}): VerseListDto {
  return {
    id: "k3Jd9QxP2mWa",
    title: "Verses to memorise",
    description: "Short passages",
    ownerName: "Noor Mahdi",
    status: "published",
    isMine: false,
    groups: [
      { id: "g001", chapter: 112, fromVerse: 1, toVerse: 4, caption: "Al-Ikhlas" },
      { id: "g002", chapter: 2, fromVerse: 1, toVerse: 20, caption: null },
    ],
    createdAt: "",
    updatedAt: "",
    publishedAt: "",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <SignInPromptProvider>
      <ListsProvider>
        <ListView />
      </ListsProvider>
    </SignInPromptProvider>,
  );
}

describe("a shared list", () => {
  beforeEach(() => {
    msal.authed = false;
    query.id = "k3Jd9QxP2mWa";
    clearArabicVersesCache();
    vi.mocked(getMyLists).mockResolvedValue([]);
    vi.mocked(getFavorites).mockResolvedValue([]);
    vi.mocked(getChapterArabic).mockImplementation((_c, from, to) => Promise.resolve(verses(from, to)));
  });
  afterEach(cleanup);

  it("shows its title, compiler and each group's Arabic to an anonymous reader", async () => {
    vi.mocked(getPublishedList).mockResolvedValue(list());
    renderPage();

    expect(await screen.findByRole("heading", { name: "Verses to memorise" })).toBeTruthy();
    expect(screen.getByText("Noor Mahdi")).toBeTruthy();
    expect(screen.getByText("Al-Ikhlas")).toBeTruthy();
    expect(screen.getByText("al-Baqarah 2:1–20")).toBeTruthy();
    // Verse 4 of both groups: al-Ikhlas ends there and al-Baqarah passes it
    expect(await screen.findAllByText("آية 4")).toHaveLength(2);
  });

  it("cuts a long group short and opens the rest with Read more", async () => {
    vi.mocked(getPublishedList).mockResolvedValue(list());
    renderPage();

    expect(await screen.findByText("آية 10")).toBeTruthy();
    expect(screen.queryByText("آية 11")).toBeNull();

    const readMore = screen.getAllByRole("button", { name: LISTS_COPY.readMore });
    expect(readMore).toHaveLength(1); // the four-verse group needs none
    fireEvent.click(readMore[0]);

    const sheet = screen.getByRole("dialog");
    expect(sheet.textContent).toContain("آية 20");
    // One request per group, shared by the preview and the sheet
    expect(getChapterArabic).toHaveBeenCalledTimes(2);
  });

  it("asks an anonymous reader to sign in before favouriting", async () => {
    vi.mocked(getPublishedList).mockResolvedValue(list());
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: LISTS_COPY.favourite }));
    expect(screen.getByRole("dialog", { name: SIGN_IN_COPY.favorites.title })).toBeTruthy();
    expect(saveListFavorite).not.toHaveBeenCalled();
  });

  it("offers its owner Edit instead of Favourite", async () => {
    msal.authed = true;
    vi.mocked(getPublishedList).mockResolvedValue(list({ isMine: true }));
    renderPage();

    expect(await screen.findByRole("link", { name: LISTS_COPY.edit })).toBeTruthy();
    expect(screen.queryByRole("button", { name: LISTS_COPY.favourite })).toBeNull();
  });

  it("says a draft or missing list isn't available", async () => {
    vi.mocked(getPublishedList).mockRejectedValue(new ApiError(404, "Not Found"));
    renderPage();
    expect(await screen.findByText(LISTS_COPY.notAvailableTitle)).toBeTruthy();
  });

  it("does not ask for a malformed id", async () => {
    query.id = "../nope";
    renderPage();
    await waitFor(() => expect(screen.getByText(LISTS_COPY.notAvailableTitle)).toBeTruthy());
    expect(getPublishedList).not.toHaveBeenCalled();
  });
});
