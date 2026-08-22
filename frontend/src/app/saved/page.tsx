"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SectionHeading from "@/components/navigation/section-heading";
import SegmentedControl from "@/components/ui/segmented-control";
import EmptyState from "@/components/empty-state";
import styles from "./page.module.css";

const tabOptions = [
  { label: "Bookmarks", value: "bookmarks" },
  { label: "Favourites", value: "favourites" },
  { label: "History", value: "history" },
];

export default function SavedPage() {
  const [tab, setTab] = useState("bookmarks");
  const router = useRouter();

  const emptyConfig = {
    bookmarks: {
      icon: "bookmark",
      title: "No bookmarks yet",
      body: "Bookmark verses while reading to find them here.",
    },
    favourites: {
      icon: "heart",
      title: "No favourites yet",
      body: "Mark your favourite verses to build a personal collection.",
    },
    history: {
      icon: "clock",
      title: "No reading history",
      body: "Your recently read chapters will appear here.",
    },
  };

  const config = emptyConfig[tab as keyof typeof emptyConfig];

  return (
    <main className={styles.main}>
      <div className="page-container">
        <SectionHeading eyebrow="Your library" title="Saved" />

        <SegmentedControl options={tabOptions} value={tab} onChange={setTab} />

        <div className={styles.content}>
          <EmptyState
            icon={config.icon}
            title={config.title}
            body={config.body}
            action={{ label: "Start reading", onClick: () => router.push("/quran/") }}
          />
        </div>
      </div>
    </main>
  );
}
