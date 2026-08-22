"use client";

import { useState, useMemo } from "react";
import SectionHeading from "@/components/navigation/section-heading";
import SearchField from "@/components/ui/search-field";
import SegmentedControl from "@/components/ui/segmented-control";
import SuraListItem from "@/components/scripture/sura-list-item";
import { suras } from "@/data/suras";
import styles from "./page.module.css";

const viewOptions = [
  { label: "SURA", value: "sura" },
  { label: "JUZ", value: "juz" },
];

export default function QuranIndexPage() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("sura");

  const filtered = useMemo(() => {
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

  const grouped = useMemo(() => {
    if (view !== "juz") return null;
    const groups: Record<number, typeof suras> = {};
    for (const sura of filtered) {
      for (const juz of sura.juz) {
        if (!groups[juz]) groups[juz] = [];
        groups[juz].push(sura);
      }
    }
    return groups;
  }, [view, filtered]);

  return (
    <main className={styles.main}>
      <div className="page-container">
        <SectionHeading eyebrow="The Holy Quran" title="All chapters" />

        <div className={styles.toolbar}>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search chapters"
          />
          <SegmentedControl options={viewOptions} value={view} onChange={setView} />
        </div>

        {view === "sura" ? (
          <div className={styles.list}>
            {filtered.map((sura) => (
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
            {filtered.length === 0 && (
              <p className={styles.noResults}>No chapters match your search.</p>
            )}
          </div>
        ) : (
          <div className={styles.juzList}>
            {grouped &&
              Object.entries(grouped)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([juz, juzSuras]) => (
                  <div key={juz} className={styles.juzGroup}>
                    <h3 className={styles.juzHeading}>Juz {juz}</h3>
                    <div className={styles.list}>
                      {juzSuras.map((sura) => (
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
                    </div>
                  </div>
                ))}
          </div>
        )}
      </div>
    </main>
  );
}
