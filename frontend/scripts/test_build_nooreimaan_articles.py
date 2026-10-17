"""Tests for build_nooreimaan_articles. Run from frontend/: python -m unittest discover -s scripts -p "test_*.py" """
import json
import tempfile
import unittest
from pathlib import Path

from build_nooreimaan_articles import carry_reflections, convert, write_reflections_index

MANIFEST = [{"slug": "naskh", "title": "Naskh", "urduTitle": "نسخ"}]


class ReflectionsIndexTests(unittest.TestCase):
    def test_lists_only_the_essays_with_reflections_by_slug(self):
        with tempfile.TemporaryDirectory() as tmp:
            essays = Path(tmp) / "essays"
            essays.mkdir()
            naskh = [{"title": "نسخ", "caption": "Naskh", "url": "articles/nooreimaan/naskh.timeline.v1.json"}]
            (essays / "naskh.json").write_text(json.dumps({"slug": "naskh", "blocks": [], "reflections": naskh}, ensure_ascii=False), encoding="utf-8")
            (essays / "hazf.json").write_text(json.dumps({"slug": "hazf", "blocks": [], "reflections": []}), encoding="utf-8")
            (essays / "amanat.json").write_text(json.dumps({"slug": "amanat", "blocks": []}), encoding="utf-8")
            index_path = Path(tmp) / "nooreimaan-reflections.json"
            index = write_reflections_index(essays, index_path)
            self.assertEqual(index, {"naskh": naskh})
            text = index_path.read_text(encoding="utf-8")
            self.assertEqual(json.loads(text), {"naskh": naskh})
            self.assertIn("نسخ", text)  # not escaped
            self.assertTrue(text.endswith("}\n"))


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

    def test_fails_on_a_row_outside_a_table(self):
        with self.assertRaisesRegex(ValueError, "<tr> outside a table"):
            blocks('<tr><td><p class="table-body" lang="ur-PK"><span class="urdu" lang="ur-PK">x</span></p></td></tr>')

    def test_fails_on_a_cell_outside_a_table_row(self):
        with self.assertRaisesRegex(ValueError, "<td> outside a table row"):
            blocks('<table><td><p class="table-body" lang="ur-PK"><span class="urdu" lang="ur-PK">x</span></p></td></table>')

    def test_fails_on_a_subheading_inside_a_table(self):
        with self.assertRaisesRegex(ValueError, "Heading-2 inside a table"):
            blocks(
                '<table><tbody><tr><td><p class="Heading-2" lang="ur-PK">'
                '<span class="urdu" lang="ur-PK">x</span></p></td></tr></tbody></table>'
            )

    def test_fails_when_the_source_and_the_manifest_disagree(self):
        with self.assertRaisesRegex(ValueError, "manifest"):
            convert(doc(heading("حذف")), MANIFEST)

    def test_matches_titles_spelled_decomposed_in_the_source_to_composed_in_the_manifest(self):
        manifest = [{"slug": "ghazwa", "title": "Ghazwa", "urduTitle": "غزوۂ ہند"}]
        out = convert(doc(heading("غزوہ\u0654 ہند")), manifest)
        self.assertEqual(out, [{"slug": "ghazwa", "urduTitle": "غزوۂ ہند", "blocks": []}])


REFLECTION = {"title": "نسخ", "url": "articles/nooreimaan/naskh.timeline.v1.json"}


class CarryReflectionsTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, slug: str, essay: dict):
        (self.dir / f"{slug}.json").write_text(json.dumps(essay, ensure_ascii=False), encoding="utf-8")

    def test_keeps_the_reflections_the_current_file_holds(self):
        self.write("naskh", {"slug": "naskh", "blocks": [], "reflections": [REFLECTION]})
        out = carry_reflections([{"slug": "naskh", "urduTitle": "نسخ", "blocks": [1]}], self.dir)
        self.assertEqual(out, [{"slug": "naskh", "urduTitle": "نسخ", "blocks": [1], "reflections": [REFLECTION]}])
        self.assertEqual(list(out[0])[-1], "reflections")

    def test_gives_an_empty_list_to_a_new_essay_or_a_file_without_reflections(self):
        self.write("hazf", {"slug": "hazf", "blocks": []})
        out = carry_reflections([{"slug": "hazf", "blocks": []}, {"slug": "naskh", "blocks": []}], self.dir)
        self.assertEqual([e["reflections"] for e in out], [[], []])

    def test_fails_when_an_essay_no_longer_in_the_manifest_has_reflections(self):
        self.write("gone", {"slug": "gone", "blocks": [], "reflections": [REFLECTION]})
        with self.assertRaisesRegex(ValueError, "gone"):
            carry_reflections([{"slug": "naskh", "blocks": []}], self.dir)

    def test_drops_an_old_essay_without_reflections_quietly(self):
        self.write("gone", {"slug": "gone", "blocks": [], "reflections": []})
        self.assertEqual(len(carry_reflections([{"slug": "naskh", "blocks": []}], self.dir)), 1)


if __name__ == "__main__":
    unittest.main()
