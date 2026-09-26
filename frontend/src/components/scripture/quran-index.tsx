"use client";

import { useState, useMemo, useEffect } from "react";
import SectionHeading from "@/components/navigation/section-heading";
import SearchField from "@/components/ui/search-field";
import SegmentedControl from "@/components/ui/segmented-control";
import SuraListItem from "@/components/scripture/sura-list-item";
import JuzListItem from "@/components/scripture/juz-list-item";
import { useReaderSettings } from "@/context/reader-settings-context";
import { suras } from "@/data/suras";
import { apiFetchWithOptionalAuth } from "@/lib/api-client";
import type { JuzDto } from "@/types/api";
import styles from "./quran-index.module.css";

/** Strip macrons, dots-below, and other combining diacritics for search. */
function stripDiacritics(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // combining diacritical marks
    .replace(/[\u02BB\u02BC\u02BD\u02BE\u02BF\u2018\u2019\u02C0]/g, ""); // ʻ ʼ ʽ ʾ ʿ ' ' ˀ
}

const viewOptions = [
  { label: "SURA", value: "sura" },
  { label: "JUZ", value: "juz" },
];

/**
 * The full index of the Quran: search plus a Sura/Juz switch over every
 * chapter or juz. Rendered by /quran/ and at the foot of the home page.
 */
export default function QuranIndex() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("sura");
  const [juzData, setJuzData] = useState<JuzDto[]>([]);
  // Ruku numbers follow the reader's language: Urdu until a signed-in reader's settings say otherwise.
  const { lang } = useReaderSettings();

  useEffect(() => {
    if (view !== "juz" || juzData.length > 0) return;

    let cancelled = false;
    apiFetchWithOptionalAuth<JuzDto[]>("/juz").then((data) => {
      if (!cancelled) setJuzData(data);
    });
    return () => { cancelled = true; };
  }, [view, juzData.length]);

  const filteredSuras = useMemo(() => {
    if (!search.trim()) return suras;
    const q = stripDiacritics(search.toLowerCase());
    return suras.filter(
      (s) =>
        stripDiacritics(s.name.toLowerCase()).includes(q) ||
        s.arabicName.includes(search) ||
        s.urduName.includes(search) ||
        String(s.number).includes(q)
    );
  }, [search]);

  const filteredJuz = useMemo(() => {
    if (!search.trim()) return juzData;
    const q = stripDiacritics(search.toLowerCase());
    return juzData.filter(
      (j) =>
        stripDiacritics(j.transliteratedName.toLowerCase()).includes(q) ||
        j.arabicName.includes(search) ||
        String(j.juzNumber).includes(q)
    );
  }, [search, juzData]);

  return (
    <>
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
              lang={lang}
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
              startChapter={juz.startChapter ?? 0}
              startVerse={juz.startVerse ?? 0}
              endChapter={juz.endChapter ?? 0}
              endVerse={juz.endVerse ?? 0}
              lang={lang}
            />
          ))}
          {filteredJuz.length === 0 && juzData.length > 0 && (
            <p className={styles.noResults}>No juz match your search.</p>
          )}
        </div>
      )}
    </>
  );
}
