# Tech debt index

The one place to start tech-debt work. Each entry links to the document that catalogues the
debt in full; the detail lives there, not here.

**Adding an entry:** write the catalogue as its own file in `plans/` (what is wrong, where, and
the fix you suggest), then add a row below with its area, a one-line summary, the date it was
recorded and its status (`open`, `in progress` or `done`). When the work is finished, set the
status to `done` and say where it was fixed rather than deleting the row.

| Area | Debt | Recorded | Status |
|---|---|---|---|
| Recitation audio | [Recitation timing issues in the Tarteel export](recitation-timing-issues.md): 62 overlapping verse spans and other defects in the Abdul Basit murattal timings, each to be settled by listening and kept as a hand override | 2026-10-13 | open |
| Articles | [Noor e Imaan essays: data issues](nooreimaan-essay-data-issues.md): whitespace-only and split runs, Urdu tagged as Arabic in the `eighteen-ayaat` headings, untagged Arabic and Persian, merged couplets, mixed Quran scripts and source typos in the 22 essay JSON files | 2026-10-16 | open |
| Podcasts | `audio/podcasts/articles/nooreimaan/mustanifa_brief.timeline.v1.json` predated the release step and named `mustanifa_brief.m4a` instead of `mustanifa_brief.v1.m4a`, so it could not play | 2026-10-16 | done 2026-10-16: `audio` corrected in v1 by hand, then attached to `jumla-e-mustanifa` |
