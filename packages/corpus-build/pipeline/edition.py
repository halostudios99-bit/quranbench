"""Emit the generated English edition from the decision table.

This is the only place the project's own translation becomes a shippable
artifact. Everything it writes is derived: same corpus version plus same
decision table always yields byte-identical output, and the edition records the
hash of the table it came from so a reader can tell which decisions produced
which words.

WHY THIS DOES NOT GO IN THE CORPUS RELEASE
------------------------------------------
The corpus releases under ``out/vX.Y.Z`` are sourced data — Tanzil's text, the
Leeds morphology, licensed human translations — sealed with checksums and not
edited after the fact. This edition is not that. It is derived work with a
different provenance (generated from a table of human decisions, no external
source consulted) and a different licence, and it changes every time a decision
is made. Writing it into a released version directory would blur exactly the
line the project exists to keep sharp.

So it is written beside the release instead, under ``qb-translation/``, and the
web app loads it as an additional edition. The manifest and its checksums are
left untouched.

PARTIAL BY CONSTRUCTION
-----------------------
Only verses whose every word is decided are emitted. A verse with an undecided
word is not written at all, so the reader shows nothing for it rather than
showing a gap and inviting the reader to fill it in. Rule 20 governs which
grades may be rendered; ``judgement`` words are recorded per verse so the reader
can mark them rather than passing them off as settled.

Usage:
    python -m pipeline.edition build
    python -m pipeline.edition build --version 0.8.0
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path

from .decisions import (
    TABLE,
    latest_version,
    load_table,
    load_tokens,
    render_verse_parts,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "qb-translation"

EDITION_ID = "en-qb-v1"

# The licence for the project's own work. Share-alike keeps derivatives open,
# which is the point of publishing the method alongside the text. Changing it is
# a one-line edit here; nothing downstream hardcodes it.
LICENCE = "CC BY-SA 4.0"
LICENCE_URL = "https://creativecommons.org/licenses/by-sa/4.0/"

DISCLAIMER = (
    "Generated from a table of word-by-word decisions, not written as prose. "
    "Arabic word order is preserved, so it reads stiffly and is not a "
    "substitute for a translation written by a person. Every verse is "
    "rendered, but the whole remains under review: words marked as judgement "
    "rest on weaker evidence than the rest and are flagged in place. No "
    "tafsir, hadith or existing translation was consulted."
)


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def build(version: str) -> None:
    table = load_table()
    tokens = load_tokens(version)

    by_verse: dict[tuple[int, str], list[dict]] = defaultdict(list)
    for token in tokens:
        by_verse[(token["surah"], token["slot"])].append(token)

    lines: list[dict] = []
    grades: Counter[str] = Counter()
    judgement_verses = 0
    # One row per judgement word, in reading order — the review queue. Kept as
    # its own artifact so the edition file and its hash are untouched by it.
    review: list[dict] = []

    for key in sorted(by_verse, key=lambda k: (k[0], 0 if k[1] == "basmala" else int(k[1]))):
        verse = by_verse[key]
        parts, blocked = render_verse_parts(verse, table)
        if blocked:
            continue

        # Word spans, not token positions. One token can render as several words
        # ("the All-Merciful") and a word can be dropped by the repetition rule,
        # so only the renderer knows which words in the finished line came from a
        # row graded judgement.
        words: list[str] = []
        judgement: list[list[int]] = []
        for word, row, token in parts:
            start = len(words)
            pieces = word.split()
            words.extend(pieces)
            if row:
                grades[row["grade"]] += 1
                if row["grade"] == "judgement":
                    judgement.append([start, len(pieces)])
                    review.append(
                        {
                            "surah": key[0],
                            "slot": key[1],
                            "arabic": token["text_no_tashkeel"],
                            "english": word,
                            "evidence": row.get("evidence", ""),
                        }
                    )
        if judgement:
            judgement_verses += 1

        lines.append(
            {
                "id": verse[0]["segment_id"],
                "surah": key[0],
                "slot": key[1],
                "text": " ".join(words),
                # [start, length] spans into the whitespace-split text.
                "judgement": judgement,
            }
        )

    OUT.mkdir(parents=True, exist_ok=True)
    body = "".join(json.dumps(line, ensure_ascii=False) + "\n" for line in lines)
    (OUT / f"{EDITION_ID}.jsonl").write_text(body, encoding="utf-8")

    edition = {
        "id": EDITION_ID,
        "language": "English",
        "language_code": "en",
        "translator": "QuranBench (generated)",
        "year": date.today().year,
        "licence": LICENCE,
        "licence_url": LICENCE_URL,
        "redistributable": True,
        "verses": len(lines),
        "artifact": f"{EDITION_ID}.jsonl",
        # The shape a TranslationEdition must have. There is no licence file to
        # point at and no external source, and saying so plainly is better than
        # borrowing a field's meaning.
        "licence_file": "",
        "source_id": "quranbench-decisions",
        "generated": True,
        "disclaimer": DISCLAIMER,
        "corpus_version": version,
        "decision_table_sha256": sha256(TABLE.read_text(encoding="utf-8")),
        "artifact_sha256": sha256(body),
        "coverage": {
            "verses_rendered": len(lines),
            "verses_total": len(by_verse),
            "words_rendered": sum(grades.values()),
            "words_total": len(tokens),
            "verses_carrying_judgement": judgement_verses,
            "grades": dict(grades.most_common()),
        },
    }
    (OUT / "edition.json").write_text(
        json.dumps(edition, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    (OUT / "review.jsonl").write_text(
        "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in review),
        encoding="utf-8",
    )

    pct = len(lines) / len(by_verse) * 100
    print(f"{EDITION_ID}: {len(lines):,} / {len(by_verse):,} verses ({pct:.1f}%)")
    print(f"  words      {sum(grades.values()):,} / {len(tokens):,}")
    print(f"  grades     " + ", ".join(f"{g}={n:,}" for g, n in grades.most_common()))
    print(f"  judgement  {judgement_verses:,} verses carry at least one")
    print(f"  -> {OUT.relative_to(ROOT.parent.parent)}/")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=("build",))
    ap.add_argument("--version", default=None)
    args = ap.parse_args()
    build(args.version or latest_version())


if __name__ == "__main__":
    main()
