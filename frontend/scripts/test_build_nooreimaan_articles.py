"""Tests for build_nooreimaan_articles. Run from frontend/: python -m unittest discover -s scripts -p "test_*.py" """
import unittest

from build_nooreimaan_articles import convert

MANIFEST = [{"slug": "naskh", "title": "Naskh", "urduTitle": "نسخ"}]


def doc(body: str) -> str:
    return f'<html><head><title>31</title></head><body><div dir="rtl">{body}</div></body></html>'


def heading(title: str) -> str:
    return (
        '<p class="Heading-1" lang="ur-PK"><span class="Heading-1-Char" lang="en-US">﴿</span>'
        f'<span class="Heading-1-Char" lang="en-US">{title}</span>'
        '<span class="Heading-1-Char" lang="en-US">﴾</span></p>'
    )


def blocks(body: str):
    return convert(doc(heading("نسخ") + body), MANIFEST)[0]["blocks"]


class ConvertTests(unittest.TestCase):
    def test_merges_runs_split_mid_word_and_trims_the_ends(self):
        out = blocks(
            '<p class="body" lang="ur-PK"><span class="urdu" lang="ur-PK"> قرآ</span>'
            '<span class="urdu" lang="ur-PK">ن  میں </span>'
            '<span class="Quran-Char" lang="ar-SA"> إِنَّمَا </span></p>'
        )
        self.assertEqual(
            out,
            [{"type": "p", "runs": [{"kind": "urdu", "text": "قرآن میں "}, {"kind": "quran", "text": "إِنَّمَا"}]}],
        )

    def test_a_span_with_no_class_kind_and_no_lang_inherits_the_paragraphs_kind(self):
        out = blocks(
            '<p class="body" lang="ur-PK"><span class="urdu" lang="ur-PK">متن</span>'
            '<span class="CharOverride-7"> </span></p>'
        )
        self.assertEqual(out, [{"type": "p", "runs": [{"kind": "urdu", "text": "متن"}]}])

    def test_takes_the_kind_from_lang_when_the_class_says_nothing(self):
        out = blocks(
            '<p class="body" lang="ur-PK">(احزاب)<span class="CharOverride-8" lang="ar-SA">النازعات</span>'
            '<span class="farsi-text" lang="fa-IR">فارسی</span><span class="english CharOverride-9" lang="en-GB">Al Fauz</span></p>'
        )
        self.assertEqual(
            [r["kind"] for r in out[0]["runs"]], ["urdu", "arabic", "farsi", "english"]
        )

    def test_numbers_subheadings_and_strips_their_ornaments(self):
        out = blocks(
            '<p class="Heading-2" lang="ur-PK"><span class="urdu" lang="ur-PK">﴿پہلی آیت﴾</span></p>'
            '<p class="Heading-2" lang="ur-PK"><span class="urdu" lang="ur-PK">﴿دوسری آیت﴾</span></p>'
        )
        self.assertEqual(
            out,
            [
                {"type": "h2", "id": "section-1", "runs": [{"kind": "urdu", "text": "پہلی آیت"}]},
                {"type": "h2", "id": "section-2", "runs": [{"kind": "urdu", "text": "دوسری آیت"}]},
            ],
        )

    def test_turns_a_two_column_table_into_a_pair_of_paragraph_lists(self):
        out = blocks(
            '<table class="nooreimaan"><colgroup><col /><col /></colgroup><tbody><tr>'
            '<td><p class="table-body" lang="ur-PK"><span class="Arabic-Char" lang="ar-SA">ولم يراع</span></p></td>'
            '<td><p class="table-body" lang="ur-PK"><span class="urdu" lang="ur-PK">اور</span></p>'
            '<p class="table-body" lang="ur-PK"><span class="urdu" lang="ur-PK">دوسرا</span></p></td>'
            "</tr></tbody></table>"
        )
        self.assertEqual(
            out,
            [{
                "type": "pair",
                "rows": [{
                    "quote": [[{"kind": "arabic", "text": "ولم يراع"}]],
                    "rendering": [[{"kind": "urdu", "text": "اور"}], [{"kind": "urdu", "text": "دوسرا"}]],
                }],
            }],
        )

    def test_drops_the_page_number_and_skips_the_dua_essay(self):
        source = doc(
            heading("دعاء ختم القران")
            + '<p class="doa" lang="ar-SA"><span class="Arabic-Char" lang="ar-SA">صَدَقَ</span></p>'
            + heading("نسخ")
            + '<p class="body" lang="ur-PK"><span class="urdu" lang="ur-PK">متن</span></p>'
            + '<p class="body-14 ParaOverride-1" lang="ur-PK"><span class="Arabic-Char CharOverride-10" lang="ar-SA">۴</span></p>'
        )
        self.assertEqual(
            convert(source, MANIFEST),
            [{"slug": "naskh", "urduTitle": "نسخ", "blocks": [{"type": "p", "runs": [{"kind": "urdu", "text": "متن"}]}]}],
        )

    def test_fails_on_an_unknown_paragraph_class(self):
        with self.assertRaisesRegex(ValueError, "unknown paragraph class"):
            blocks('<p class="caption" lang="ur-PK"><span class="urdu" lang="ur-PK">x</span></p>')

    def test_fails_on_a_row_without_two_cells(self):
        with self.assertRaisesRegex(ValueError, "3 cells"):
            blocks(
                "<table><tbody><tr>"
                + '<td><p class="table-body" lang="ur-PK"><span class="urdu" lang="ur-PK">x</span></p></td>' * 3
                + "</tr></tbody></table>"
            )

    def test_fails_on_an_empty_cell(self):
        with self.assertRaisesRegex(ValueError, "empty table cell"):
            blocks(
                '<table><tbody><tr><td></td><td><p class="table-body" lang="ur-PK">'
                '<span class="urdu" lang="ur-PK">x</span></p></td></tr></tbody></table>'
            )

    def test_fails_when_the_source_and_the_manifest_disagree(self):
        with self.assertRaisesRegex(ValueError, "manifest"):
            convert(doc(heading("حذف")), MANIFEST)

    def test_matches_titles_spelled_decomposed_in_the_source_to_composed_in_the_manifest(self):
        manifest = [{"slug": "ghazwa", "title": "Ghazwa", "urduTitle": "غزوۂ ہند"}]
        out = convert(doc(heading("غزوہ\u0654 ہند")), manifest)
        self.assertEqual(out, [{"slug": "ghazwa", "urduTitle": "غزوۂ ہند", "blocks": []}])


if __name__ == "__main__":
    unittest.main()
