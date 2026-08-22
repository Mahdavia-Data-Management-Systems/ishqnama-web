"use client";

import { useState } from "react";
import SearchField from "@/components/ui/search-field";
import SegmentedControl from "@/components/ui/segmented-control";
import EmptyState from "@/components/empty-state";
import SectionHeading from "@/components/navigation/section-heading";
import styles from "./page.module.css";

const tabOptions = [
  { label: "All", value: "all" },
  { label: "Chapters", value: "chapters" },
  { label: "Verses", value: "verses" },
  { label: "Tafseer", value: "tafseer" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");

  return (
    <main className={styles.main}>
      <div className="page-container">
        <SectionHeading eyebrow="Explore" title="Search" />

        <div className={styles.searchBar}>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Search the Quran"
            autoFocus
          />
        </div>

        <SegmentedControl options={tabOptions} value={tab} onChange={setTab} />

        <div className={styles.results}>
          {!query ? (
            <EmptyState
              icon="search"
              title="Search the Quran"
              body="Search for chapters, verses, or topics across translations and tafseer."
            />
          ) : (
            <EmptyState
              icon="search"
              title="No results"
              body="Search results will appear here when the API is connected."
            />
          )}
        </div>
      </div>
    </main>
  );
}
