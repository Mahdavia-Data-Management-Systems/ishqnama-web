export const bookmarkIcons = [
  { key: "bookmark", label: "Bookmark" },
  { key: "heart", label: "Heart" },
  { key: "moon", label: "Moon" },
  { key: "home", label: "Home" },
  { key: "clock", label: "Clock" },
  { key: "user", label: "User" },
  { key: "check", label: "Check" },
] as const;

export type BookmarkIconKey = (typeof bookmarkIcons)[number]["key"];
