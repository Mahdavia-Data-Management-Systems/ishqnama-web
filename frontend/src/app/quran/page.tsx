"use client";

import { useState, useMemo, useEffect } from "react";
import SectionHeading from "@/components/navigation/section-heading";
import SearchField from "@/components/ui/search-field";
import SegmentedControl from "@/components/ui/segmented-control";
import SuraListItem from "@/components/scripture/sura-list-item";
import JuzListItem from "@/components/scripture/juz-list-item";
import { suras } from "@/data/suras";
import { apiFetchWithOptionalAuth } from "@/lib/api-client";
import styles from "./page.module.css";

interface JuzItem {
  juzNumber: number;
  arabicName: string;
  transliteratedName: string;
  startChapter: number;
  startVerse: number;
  endChapter: number;
  endVerse: number;
}

const viewOptions = [
  { label: "SURA", value: "sura" },
  { label: "JUZ", value: "juz" },
];

export default function QuranIndexPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("sura");
  const [juzData, setJuzData] = useState<JuzItem[]>([]);

  useEffect(() => {
    if (view !== "juz" || juzData.length > 0) return;

    let cancelled = false;
    apiFetchWithOptionalAuth<JuzItem[]>("/juz").then((data) => {
      if (!cancelled) setJuzData(data);
    });
    return () => { cancelled = true; };
  }, [view, juzData.length]);

  const filteredSuras = useMemo(() => {
    if (!search.trim()) return suras;
    const q = search.toLowerCase();
    return suras.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.arabicName.includes(search) ||
        s.urduName.includes(search) ||
        String(s.number).includes(q)
    );
  }, [search]);

  const filteredJuz = useMemo(() => {
    if (!search.trim()) return juzData;
    const q = search.toLowerCase();
    return juzData.filter(
      (j) =>
        j.transliteratedName.toLowerCase().includes(q) ||
        j.arabicName.includes(search) ||
        String(j.juzNumber).includes(q)
    );
  }, [search, juzData]);

  return (
    <main className={styles.main}>
      <div className="page-container">
        <SectionHeading eyebrow="The Holy Quran" title={view === "sura" ? "All chapters" : "All Ajza"} />

        <div className={styles.toolbar}>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={view === "sura" ? "Search chapters" : "Search juz"}
          />
          <SegmentedControl options={viewOptions} value={view} onChange={setView} />
        </div>

        {view === "sura" ? (
          <div className={styles.list}>
            {filteredSuras.map((sura) => (
              <SuraListItem
                key={sura.number}
                number={sura.number}
                name={sura.name}
                arabicName={sura.arabicName}
                urduName={sura.urduName}
                revelationType={sura.revelationType}
                verseCount={sura.verseCount}
              />
            ))}
            {filteredSuras.length === 0 && (
              <p className={styles.noResults}>No chapters match your search.</p>
            )}
          </div>
        ) : (
          <div className={styles.list}>
            {filteredJuz.map((juz) => (
              <JuzListItem
                key={juz.juzNumber}
                juzNumber={juz.juzNumber}
                arabicName={juz.arabicName}
                transliteratedName={juz.transliteratedName}
                startChapter={juz.startChapter}
                startVerse={juz.startVerse}
                endChapter={juz.endChapter}
                endVerse={juz.endVerse}
              />
            ))}
            {filteredJuz.length === 0 && juzData.length > 0 && (
              <p className={styles.noResults}>No juz match your search.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
