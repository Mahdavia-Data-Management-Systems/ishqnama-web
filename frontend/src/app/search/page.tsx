"use client";

import { useState } from "react";
import SearchField from "@/components/ui/search-field";
import SegmentedControl from "@/components/ui/segmented-control";
import EmptyState from "@/components/empty-state";
import SectionHeading from "@/components/navigation/section-heading";
import styles from "./page.module.css";

const tabOptions = [
  { label: "Both", value: "both" },
  { label: "Tarjuma", value: "tarjuma" },
  { label: "Tafseer", value: "tafseer" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("both");

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
              title="Search in Noor e Imaan"
              body="Search anything across translations and tafseer."
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
