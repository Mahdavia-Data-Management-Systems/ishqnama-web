"""Converts the InDesign HTML export of Noor e Imaan's essays (31.html) into one JSON file per essay,
which the API embeds and serves to signed-in readers.

Titles and slugs come from src/data/articles/nooreimaan.json, in book order; the dua essay is skipped
(it lives, corrected, at /nooreimaan/dua/). The text is kept as exported: InDesign's runs are merged and
whitespace collapsed, nothing else. Anything unrecognised fails the run rather than being guessed at.

Usage, from frontend/: npm run articles:build [-- path/to/31.html]
"""
import json
import re
import sys
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

FRONTEND = Path(__file__).resolve().parent.parent
MANIFEST = FRONTEND / "src" / "data" / "articles" / "nooreimaan.json"
OUT_DIR = FRONTEND.parent / "backend" / "src" / "Ishqnama.Application" / "Articles" / "NoorEImaan"
DEFAULT_SOURCE = FRONTEND.parent / ".ishqnama" / "articles" / "31.html"

SKIPPED_ESSAYS = {unicodedata.normalize("NFC", "دعاء ختم القران")}
SPAN_KINDS = {
    "urdu": "urdu",
    "Heading-1-Char": "urdu",
    "Quran-Char": "quran",
    "Arabic-Char": "arabic",
    "farsi-text": "farsi",
    "english": "english",
}
LANG_KINDS = {"ur": "urdu", "ar": "arabic", "fa": "farsi", "en": "english"}
BODY_CLASSES = {"body", "arabic", "table-body"}  # "arabic" is one paragraph of Urdu prose
SKIPPED_CLASSES = {"doa", "body-14"}  # the dua; a stray page number
ORNAMENTS = str.maketrans("", "", "﴿﴾")


def kind_for(classes: list[str], lang: str | None) -> str:
    for c in classes:
        if c in SPAN_KINDS:
            return SPAN_KINDS[c]
    prefix = (lang or "").split("-")[0]
    if prefix in LANG_KINDS:
        return LANG_KINDS[prefix]
    raise ValueError(f"no run kind for classes {classes} and lang {lang!r}")


def merge(runs: list[tuple[str, str]]) -> list[dict]:
    """Joins neighbouring runs of one kind (InDesign splits them mid-word), collapses whitespace and
    trims the paragraph's ends."""
    merged: list[dict] = []
    for kind, text in runs:
        if merged and merged[-1]["kind"] == kind:
            merged[-1]["text"] += text
        else:
            merged.append({"kind": kind, "text": text})
    for run in merged:
        run["text"] = re.sub(r"\s+", " ", run["text"])
    for a, b in zip(merged, merged[1:]):
        if a["text"].endswith(" ") and b["text"].startswith(" "):
            b["text"] = b["text"][1:]
    if merged:
        merged[0]["text"] = merged[0]["text"].lstrip()
        merged[-1]["text"] = merged[-1]["text"].rstrip()
    kept = [(r["kind"], r["text"]) for r in merged if r["text"]]
    if len(kept) < len(merged):
        return merge(kept)  # dropping an empty run can leave two runs of one kind side by side
    return [{"kind": k, "text": t} for k, t in kept]


class ExportParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.essays: list[dict] = []
        self.in_body = False
        self.para: dict | None = None
        self.spans: list[str] = []
        self.table: list[list[list[list[dict]]]] | None = None  # rows > cells > paragraphs > runs

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        classes = (a.get("class") or "").split()
        if tag == "body":
            self.in_body = True
        elif tag == "p":
            if self.para is not None:
                raise ValueError("nested <p>")
            self.para = {"cls": classes[0] if classes else "", "lang": a.get("lang"), "runs": []}
        elif tag == "span":
            if self.para is None:
                raise ValueError("<span> outside a paragraph")
            lang = a.get("lang")
            if not lang and not any(c in SPAN_KINDS for c in classes):
                lang = self.para["lang"]  # HTML lang inheritance: the span takes its paragraph's language
            self.spans.append(kind_for(classes, lang))
        elif tag == "table":
            if self.table is not None:
                raise ValueError("nested <table>")
            self.table = []
        elif tag == "tr":
            if self.table is None:
                raise ValueError("<tr> outside a table")
            self.table.append([])
        elif tag == "td":
            if not self.table:
                raise ValueError("<td> outside a table row")
            self.table[-1].append([])

    def handle_endtag(self, tag):
        if tag == "span":
            self.spans.pop()
        elif tag == "p":
            self.end_paragraph()
        elif tag == "table":
            self.end_table()

    def handle_data(self, data):
        if not self.in_body:
            return
        if self.para is None:
            if data.strip():
                raise ValueError(f"text outside a paragraph: {data[:40]!r}")
            return
        kind = self.spans[-1] if self.spans else kind_for([], self.para["lang"])
        self.para["runs"].append((kind, data))

    def end_paragraph(self):
        para, self.para = self.para, None
        cls = para["cls"]
        if cls in SKIPPED_CLASSES:
            return
        if cls.startswith("Heading-") and self.table is not None:
            raise ValueError(f"{cls} inside a table")
        if cls == "Heading-1":
            title = "".join(text for _, text in para["runs"]).translate(ORNAMENTS)
            self.essays.append({"urduTitle": re.sub(r"\s+", " ", title).strip(), "blocks": [], "sections": 0})
            return
        if not self.essays:
            raise ValueError("text before the first essay heading")
        essay = self.essays[-1]
        if cls == "Heading-2":
            essay["sections"] += 1
            runs = merge([(kind, text.translate(ORNAMENTS)) for kind, text in para["runs"]])
            essay["blocks"].append({"type": "h2", "id": f"section-{essay['sections']}", "runs": runs})
            return
        if cls not in BODY_CLASSES:
            raise ValueError(f"unknown paragraph class {cls!r}")
        runs = merge(para["runs"])
        if not runs:
            return
        if self.table is not None:
            self.table[-1][-1].append(runs)
        else:
            essay["blocks"].append({"type": "p", "runs": runs})

    def end_table(self):
        rows, self.table = self.table, None
        pair = []
        for row in rows:
            if len(row) != 2:
                raise ValueError(f"table row with {len(row)} cells")
            if not row[0] or not row[1]:
                raise ValueError("empty table cell")
            pair.append({"quote": row[0], "rendering": row[1]})
        self.essays[-1]["blocks"].append({"type": "pair", "rows": pair})


def nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)


def convert(source_html: str, manifest: list[dict]) -> list[dict]:
    parser = ExportParser()
    parser.feed(source_html)
    parser.close()
    # Titles are compared composed: the export spells some letters decomposed (ہ + U+0654), the manifest
    # composed (ۂ). Body text is never normalised.
    essays = [e for e in parser.essays if nfc(e["urduTitle"]) not in SKIPPED_ESSAYS]
    found = [nfc(e["urduTitle"]) for e in essays]
    expected = [nfc(m["urduTitle"]) for m in manifest]
    if found != expected:
        raise ValueError(f"the source's essays and the manifest disagree:\n  source:   {found}\n  manifest: {expected}")
    return [
        {"slug": m["slug"], "urduTitle": m["urduTitle"], "blocks": e["blocks"]}
        for m, e in zip(manifest, essays)
    ]


def main(argv: list[str]) -> None:
    source = Path(argv[1]) if len(argv) > 1 else DEFAULT_SOURCE
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    essays = convert(source.read_text(encoding="utf-8"), manifest)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.json"):
        old.unlink()
    for essay in essays:
        text = json.dumps(essay, ensure_ascii=False, indent=1) + "\n"
        (OUT_DIR / f"{essay['slug']}.json").write_text(text, encoding="utf-8", newline="\n")
    print(f"Wrote {len(essays)} essays to {OUT_DIR}")


if __name__ == "__main__":
    main(sys.argv)
