"""Stage 4 — build.

Assemble parsed + normalised records into the versioned artifact directory
``out/<version>/`` containing:

    sources.json    one record per ingested Source (with sha256)
    surahs.json     one record per surah
    verses.jsonl    one record per verse
    manifest.json   version, timestamp, source checksums, normalisation rules

A reader must be able to reconstruct what was done from ``manifest.json`` alone.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import CORPUS_VERSION, WORK_ID
from .fetch import fetch_all
from .identifiers import surah_id, verse_id
from .normalise import NORMALISATION_RULES, derive_text_fields
from .parse import parse_metadata, parse_text
from .paths import OUT_DIR, SOURCES_DIR, sha256_file
from .sources import SEGMENTATION_SOURCE_ID, SOURCES

FIELD_PROVENANCE: dict[str, Any] = {
    "text_uthmani": {"source_id": "tanzil-uthmani", "transform": []},
    "text_simple": {"source_id": "tanzil-simple", "transform": []},
    "text_no_tashkeel": {
        "source_id": "tanzil-uthmani",
        "transform": ["strip-tashkeel"],
    },
    "text_normalised": {
        "source_id": "tanzil-uthmani",
        "transform": [
            "strip-tashkeel",
            "remove-tatweel",
            "unify-alef",
            "normalise-ta-marbuta",
            "normalise-alif-maqsura",
        ],
    },
    "surah_names": {"source_id": "tanzil-metadata", "transform": []},
}


def _read(filename: str) -> str:
    return (SOURCES_DIR / filename).read_text(encoding="utf-8")


def _built_at() -> str:
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    when = (
        datetime.fromtimestamp(int(epoch), tz=timezone.utc)
        if epoch
        else datetime.now(timezone.utc)
    )
    return when.replace(microsecond=0).isoformat()


def build_verse_records() -> list[dict[str, Any]]:
    uthmani = parse_text(_read("tanzil-uthmani.txt"))
    simple = parse_text(_read("tanzil-simple.txt"))

    simple_by_key = {(v.surah, v.ayah): v.text for v in simple}
    if {(v.surah, v.ayah) for v in uthmani} != set(simple_by_key):
        raise ValueError("Uthmani and Simple editions disagree on the verse set")

    records: list[dict[str, Any]] = []
    for v in uthmani:
        fields = derive_text_fields(v.text, simple_by_key[(v.surah, v.ayah)])
        records.append(
            {
                "id": verse_id(v.surah, v.ayah),
                "work_id": WORK_ID,
                "source_id": SEGMENTATION_SOURCE_ID,
                "surah": v.surah,
                "ayah": v.ayah,
                **fields,
            }
        )
    return records


def build_surah_records(verses: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[int, int] = {}
    for v in verses:
        counts[v["surah"]] = counts.get(v["surah"], 0) + 1

    metas = parse_metadata(_read("quran-metadata.xml"))
    records: list[dict[str, Any]] = []
    for m in metas:
        derived = counts.get(m.number, 0)
        if derived != m.ayas:
            raise ValueError(
                f"surah {m.number}: parsed {derived} verses, metadata says {m.ayas}"
            )
        records.append(
            {
                "id": surah_id(m.number),
                "number": m.number,
                "name_ar": m.name_ar,
                "name_translit": m.name_translit,
                "name_en": m.name_en,
                "revelation_place": m.revelation_place,
                "revelation_order": m.revelation_order,
                "verse_count": derived,
                "source_id": "tanzil-metadata",
            }
        )
    return records


def build_source_records() -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for s in SOURCES:
        records.append(
            {
                "id": s.id,
                "name": s.name,
                "publisher": s.publisher,
                "edition": s.edition,
                "year": s.year,
                "url": s.url,
                "licence": s.licence,
                "role": s.role,
                "sha256": sha256_file(SOURCES_DIR / s.filename),
            }
        )
    return records


def build_manifest(
    sources: list[dict[str, Any]],
    surahs: list[dict[str, Any]],
    verses: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "corpus_version": CORPUS_VERSION,
        "work_id": WORK_ID,
        "built_at": _built_at(),
        "generator": "quranbench/packages/corpus-build",
        "segmentation_scheme": SEGMENTATION_SOURCE_ID,
        "counts": {"surahs": len(surahs), "verses": len(verses)},
        "sources": [{"id": s["id"], "sha256": s["sha256"]} for s in sources],
        "field_provenance": FIELD_PROVENANCE,
        "normalisation_rules": [
            {
                "id": r.id,
                "description": r.description,
                "applies_to": list(r.applies_to),
                "detail": r.detail,
            }
            for r in NORMALISATION_RULES
        ],
    }


def _write_json(path: Path, data: Any) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


def build(out_root: Path = OUT_DIR) -> Path:
    fetch_all()

    verses = build_verse_records()
    surahs = build_surah_records(verses)
    sources = build_source_records()
    manifest = build_manifest(sources, surahs, verses)

    out_dir = out_root / f"v{CORPUS_VERSION}"
    out_dir.mkdir(parents=True, exist_ok=True)
    _write_json(out_dir / "sources.json", sources)
    _write_json(out_dir / "surahs.json", surahs)
    _write_jsonl(out_dir / "verses.jsonl", verses)
    _write_json(out_dir / "manifest.json", manifest)
    return out_dir


def main() -> int:
    out_dir = build()
    print(f"built {out_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
