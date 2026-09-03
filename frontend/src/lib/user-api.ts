import { authenticatedApiFetch } from "./api-client";
import type {
  UserSettingsDto,
  UserBookmarkDto,
  UserFavoriteDto,
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

// Favorites

export function getUserFavorites(signal?: AbortSignal): Promise<UserFavoriteDto[]> {
  return authenticatedApiFetch<UserFavoriteDto[]>("/user/favorites", { signal });
}

export function addFavorite(chapterNumber: number, verseNumber: number): Promise<void> {
  return authenticatedApiFetch<void>("/user/favorites", {
    method: "POST",
    body: { chapterNumber, verseNumber },
  });
}

export function removeFavorite(chapterNumber: number, verseNumber: number): Promise<void> {
  return authenticatedApiFetch<void>(`/user/favorites/${chapterNumber}/${verseNumber}`, {
    method: "DELETE",
  });
}

// History

export function getUserHistory(signal?: AbortSignal): Promise<UserHistoryDto[]> {
  return authenticatedApiFetch<UserHistoryDto[]>("/user/history", { signal });
}

export function addHistoryEntry(chapterNumber: number): Promise<void> {
  return authenticatedApiFetch<void>("/user/history", {
    method: "POST",
    body: { chapterNumber },
  });
}
