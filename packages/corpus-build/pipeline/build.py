"""Stage 4 — build.

Assemble parsed + normalised records into the versioned artifact directory
``out/<version>/`` containing:

    sources.json     one record per ingested Source (with sha256)
    surahs.json      one record per surah (incl. its separated basmala)
    verses.jsonl     one record per verse
    tokens.jsonl     one record per token
    identifiers.json the identifier policy in machine-readable form
    mapping/         version-to-version identifier mapping (scaffold + schema)
    manifest.json    version, timestamp, source checksums, normalisation rules

A reader must be able to reconstruct what was done from ``manifest.json`` alone.
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from . import CORPUS_VERSION, WORK_ID
from .basmala import (
    CANONICAL_BASMALA,
    _SIMPLE_BASMALAS,
    _UTHMANI_BASMALAS,
    BasmalaSplit,
    split_simple,
    split_uthmani,
)
from .fetch import fetch_all
from .identifiers import BASMALA_AYAH, IDENTIFIER_FORMAT, surah_id, token_id, verse_id
from .normalise import NORMALISATION_RULES, derive_text_fields, derive_token_fields
from .parse import parse_metadata, parse_text
from .paths import OUT_DIR, SOURCES_DIR, sha256_file
from .sources import SEGMENTATION_SOURCE_ID, SOURCES
from .tokens import Token, segment_basmala, segment_verse

PREVIOUS_VERSION = "0.1.0"

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

# Token text_simple is NOT the Simple edition: the two editions do not tokenise
# word-for-word, so a token has no aligned Simple counterpart. It is computed from
# the token's own Uthmani text. This is recorded distinctly so the provenance of a
# token form is never confused with a verse form of the same name.
TOKEN_FIELD_PROVENANCE: dict[str, Any] = {
    "text_uthmani": {"source_id": "tanzil-uthmani", "transform": []},
    "text_simple": {"source_id": "tanzil-uthmani", "transform": ["to-simple"]},
    "text_no_tashkeel": {"source_id": "tanzil-uthmani", "transform": ["strip-tashkeel"]},
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


@dataclass
class Assembled:
    verses: list[dict[str, Any]]
    tokens: list[dict[str, Any]]
    #: surah -> (uthmani split, simple split); surah 9 maps to (absent, absent).
    basmala: dict[int, tuple[BasmalaSplit, BasmalaSplit]]
    marks_excluded: int


def assemble() -> Assembled:
    uthmani = parse_text(_read("tanzil-uthmani.txt"))
    simple = parse_text(_read("tanzil-simple.txt"))

    simple_by_key = {(v.surah, v.ayah): v.text for v in simple}
    if {(v.surah, v.ayah) for v in uthmani} != set(simple_by_key):
        raise ValueError("Uthmani and Simple editions disagree on the verse set")

    verses: list[dict[str, Any]] = []
    tokens: list[Token] = []
    basmala: dict[int, tuple[BasmalaSplit, BasmalaSplit]] = {}
    marks_excluded = 0

    for v in uthmani:
        simple_text = simple_by_key[(v.surah, v.ayah)]
        if v.ayah == 1:
            u_split = split_uthmani(v.surah, v.text)
            s_split = split_simple(v.surah, simple_text)
            basmala[v.surah] = (u_split, s_split)
            u_text, s_text = u_split.verse_one, s_split.verse_one
        else:
            u_text, s_text = v.text, simple_text

        seg = segment_verse(v.surah, v.ayah, u_text)
        marks_excluded += seg.marks_excluded
        tokens.extend(seg.tokens)
        verses.append(
            {
                "id": verse_id(v.surah, v.ayah),
                "work_id": WORK_ID,
                "source_id": SEGMENTATION_SOURCE_ID,
                "surah": v.surah,
                "ayah": v.ayah,
                **derive_text_fields(u_text, s_text),
                "leading_marks": seg.leading_marks,
            }
        )

    for surah, (u_split, _s_split) in basmala.items():
        if u_split.separated and u_split.basmala is not None:
            seg = segment_basmala(surah, u_split.basmala)
            tokens.extend(seg.tokens)

    tokens.sort(key=lambda t: (t.surah, t.ayah, t.position))
    token_records = [t.record() for t in tokens]
    return Assembled(verses, token_records, basmala, marks_excluded)


def _basmala_field(
    surah: int, split_pair: tuple[BasmalaSplit, BasmalaSplit] | None
) -> dict[str, Any] | None:
    if split_pair is None:  # surah 9 — no basmala, explicitly absent.
        return None
    u_split, _ = split_pair
    if u_split.basmala is None:
        return None

    n = len(u_split.basmala.split(" "))
    ayah = BASMALA_AYAH if u_split.separated else 1
    return {
        "separated": u_split.separated,
        **derive_token_fields(u_split.basmala),
        "token_range": {
            "ayah": ayah,
            "first_id": token_id(surah, ayah, 1),
            "last_id": token_id(surah, ayah, n),
            "count": n,
        },
    }


def build_surah_records(
    verses: list[dict[str, Any]],
    basmala: dict[int, tuple[BasmalaSplit, BasmalaSplit]],
) -> list[dict[str, Any]]:
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
                "basmala": _basmala_field(m.number, basmala.get(m.number)),
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


def build_identifiers() -> dict[str, Any]:
    return {
        "scheme": SEGMENTATION_SOURCE_ID,
        "format": IDENTIFIER_FORMAT,
        "components": ["work", "scheme", "surah", "ayah", "position"],
        "position_1_based": True,
        "guarantees": {
            "opaque_and_permanent": True,
            "position_is_attribute_not_identity": True,
            "detail": (
                "The identity string encodes (surah, ayah, position) under a named "
                "segmentation scheme, but position is an attribute of the token, not "
                "its identity. A token that moves, splits or merges in a later corpus "
                "version receives an explicit successor or tombstone in mapping/."
            ),
        },
        "basmala_ayah": BASMALA_AYAH,
        "basmala_note": (
            "A separated surah-opening basmala is addressed as ayah 0. Al-Fatiha's "
            "basmala is verse 1:1 and keeps that identity."
        ),
    }


def _mapping_schema() -> dict[str, Any]:
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "corpus identifier version mapping",
        "type": "object",
        "required": ["from_version", "to_version", "mappings"],
        "properties": {
            "from_version": {"type": "string"},
            "to_version": {"type": "string"},
            "note": {"type": "string"},
            "mappings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "required": ["from", "status"],
                    "properties": {
                        "from": {"type": "string", "description": "prior-version id"},
                        "status": {
                            "enum": [
                                "unchanged",
                                "moved",
                                "renamed",
                                "split",
                                "merged",
                                "tombstone",
                            ]
                        },
                        "to": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "successor id(s); empty for a tombstone",
                        },
                        "reason": {"type": "string"},
                    },
                },
            },
        },
    }


def _mapping_scaffold() -> dict[str, Any]:
    return {
        "from_version": PREVIOUS_VERSION,
        "to_version": CORPUS_VERSION,
        "note": (
            "v0.1.0 published no token layer, so no token ids need remapping. Verse "
            "ids are unchanged. This file is the scaffold required by the identifier "
            "policy; it is populated only when a future version changes segmentation."
        ),
        "mappings": [],
    }


def build_manifest(
    sources: list[dict[str, Any]],
    surahs: list[dict[str, Any]],
    verses: list[dict[str, Any]],
    tokens: list[dict[str, Any]],
    basmala: dict[int, tuple[BasmalaSplit, BasmalaSplit]],
    marks_excluded: int,
) -> dict[str, Any]:
    separated = sum(1 for pair in basmala.values() if pair[0].separated)
    uthmani_source = next(s for s in sources if s["id"] == "tanzil-uthmani")
    return {
        "corpus_version": CORPUS_VERSION,
        "previous_version": PREVIOUS_VERSION,
        "work_id": WORK_ID,
        "built_at": _built_at(),
        "generator": "quranbench/packages/corpus-build",
        "segmentation_scheme": SEGMENTATION_SOURCE_ID,
        "identifier_format": IDENTIFIER_FORMAT,
        "counts": {
            "surahs": len(surahs),
            "verses": len(verses),
            "tokens": len(tokens),
        },
        "basmala_handling": "separated",
        "basmala": {
            "canonical": CANONICAL_BASMALA,
            "uthmani_variants": list(_UTHMANI_BASMALAS),
            "simple_variants": list(_SIMPLE_BASMALAS),
            "separated_from_surahs": separated,
            "no_basmala_surahs": [
                s["number"] for s in surahs if s["basmala"] is None
            ],
            "basmala_is_verse_surahs": [
                s["number"]
                for s in surahs
                if s["basmala"] is not None and not s["basmala"]["separated"]
            ],
        },
        "token_segmentation": {
            "rule": "whitespace-delimited words; morphology not applied",
            "waqf_marks_excluded": marks_excluded,
            "non_token_ranges": [
                "U+06D6..U+06ED",
                "U+0660..U+0669",
                "U+06F0..U+06F9",
            ],
        },
        "source_download_options": {
            "tanzil-uthmani": {
                "marks": True,
                "sajdah": True,
                "rub": True,
                "url": uthmani_source["url"],
            }
        },
        "sources": [{"id": s["id"], "sha256": s["sha256"]} for s in sources],
        "field_provenance": FIELD_PROVENANCE,
        "token_field_provenance": TOKEN_FIELD_PROVENANCE,
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

    assembled = assemble()
    surahs = build_surah_records(assembled.verses, assembled.basmala)
    sources = build_source_records()
    manifest = build_manifest(
        sources,
        surahs,
        assembled.verses,
        assembled.tokens,
        assembled.basmala,
        assembled.marks_excluded,
    )

    out_dir = out_root / f"v{CORPUS_VERSION}"
    (out_dir / "mapping").mkdir(parents=True, exist_ok=True)
    _write_json(out_dir / "sources.json", sources)
    _write_json(out_dir / "surahs.json", surahs)
    _write_jsonl(out_dir / "verses.jsonl", assembled.verses)
    _write_jsonl(out_dir / "tokens.jsonl", assembled.tokens)
    _write_json(out_dir / "identifiers.json", build_identifiers())
    _write_json(out_dir / "mapping" / "mapping.schema.json", _mapping_schema())
    _write_json(
        out_dir / "mapping" / f"v{PREVIOUS_VERSION}-to-v{CORPUS_VERSION}.json",
        _mapping_scaffold(),
    )
    _write_json(out_dir / "manifest.json", manifest)

    print(
        f"built {out_dir}\n"
        f"  surahs={manifest['counts']['surahs']} "
        f"verses={manifest['counts']['verses']} "
        f"tokens={manifest['counts']['tokens']}\n"
        f"  basmala separated from {manifest['basmala']['separated_from_surahs']} surahs\n"
        f"  waqf marks excluded: {manifest['token_segmentation']['waqf_marks_excluded']}"
    )
    return out_dir


def main() -> int:
    build()
    return 0


if __name__ == "__main__":
    sys.exit(main())
