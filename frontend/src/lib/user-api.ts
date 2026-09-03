import { authenticatedApiFetch } from "./api-client";
import type {
  UserSettingsDto,
  UserBookmarkDto,
  UserHistoryDto,
} from "@/types/user";

// Settings

export function getUserSettings(signal?: AbortSignal): Promise<UserSettingsDto | null> {
  return authenticatedApiFetch<UserSettingsDto | null>("/user/settings", { signal });
}

export function saveUserSettings(settings: UserSettingsDto, signal?: AbortSignal): Promise<void> {
  return authenticatedApiFetch<void>("/user/settings", {
    method: "PUT",
    body: settings,
    signal,
  });
}

// Bookmarks

export function getUserBookmarks(signal?: AbortSignal): Promise<UserBookmarkDto[]> {
  return authenticatedApiFetch<UserBookmarkDto[]>("/user/bookmarks", { signal });
}

export function createBookmark(title: string, icon: string): Promise<UserBookmarkDto> {
  return authenticatedApiFetch<UserBookmarkDto>("/user/bookmarks", {
    method: "POST",
    body: { title, icon },
  });
}

export function updateBookmarkPosition(slug: string, chapterNumber: number, verseNumber: number): Promise<void> {
  return authenticatedApiFetch<void>(`/user/bookmarks/${encodeURIComponent(slug)}/position`, {
    method: "PUT",
    body: { chapterNumber, verseNumber },
  });
}

export function deleteBookmark(slug: string): Promise<void> {
  return authenticatedApiFetch<void>(`/user/bookmarks/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

// History

export function getUserHistory(signal?: AbortSignal): Promise<UserHistoryDto[]> {
  return authenticatedApiFetch<UserHistoryDto[]>("/user/history", { signal });
}

export function addHistoryEntry(title: string, url: string): Promise<void> {
  return authenticatedApiFetch<void>("/user/history", {
    method: "POST",
    body: { title, url },
  });
}
