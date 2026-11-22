# Tafseer takhreej: data issues

Recorded 2026-11-22. The data lives in the sibling `ishqnama-db` repo
(`database/scripts/seed/*-ur.sql`); nothing here can be fixed in `ishqnama-web`.

## Citations written into the prose, outside any takhreej mark

The reader only treats a book as takhreej when it sits in the passage's
`<mark>…<ins data-takhreej="n"></ins></mark>` (see `plans/frontend-takhreej-spec.md`). A few
explanations name their source in brackets inside the running text instead, so they show as
ordinary prose: no wash, no book button, and nothing in the Takhreej sheet.

| Where | Text as written |
|---|---|
| Juz 1 (`013-seed-translation-segments-juz-01-ur.sql`) | `(تفسیرابن عربی صفحہ ۵۴ )` |
| Juz 7 (`031-seed-translation-segments-juz-07-ur.sql`) | `(تفسیر شیخ کبیر صفحہ ۱۰)` |
| Juz 12 (`046-seed-translation-segments-juz-12-ur.sql`) | `(ترمذی )` twice, `(مسلم )` once |
| Juz 27 (`091-seed-translation-segments-juz-27-ur.sql`) | `(تفسیر ابن عربی جلد دوم صفحہ ۲۷۳)` |

These were found by searching for the strings above on 2026-11-22; other bracketed sources may
exist and a wider search of the Urdu files is part of the fix.

## Suggested fix

For each one, in `ishqnama-db`: wrap the passage the source supports in `<mark>`, replace the
bracketed text with an `<ins data-takhreej="n"></ins>` anchor at the passage's end, and add the
book (if it is not already in `Books`) and a `TranslationSegmentCitations` row with the page as
its `Reference`. Only a reader of the text can say where each passage starts. No frontend or
API change is needed.
