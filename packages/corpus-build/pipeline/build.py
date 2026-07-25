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
from .identifiers import BASMALA_SLOT, IDENTIFIER_FORMAT, segment_id, surah_id, token_id
from .normalise import NORMALISATION_RULES, derive_text_fields, derive_token_fields
from .numbering import (
    BASMALA_KIND,
    DEFAULT_SCHEME_ID,
    SCHEMES,
    VERSE_KIND,
    Segment,
    assign_ordinals,
)
from .morphology import annotate, render_report, report_stats
from .parse import parse_metadata, parse_text
from .paths import DATA_DIR, OUT_DIR, SOURCES_DIR, sha256_bytes, sha256_file
from .sources import MORPHOLOGY_SOURCE_ID, SEGMENTATION_SOURCE_ID, SOURCES
from .tarball import is_distribution_file, write_full_tarball
from .tokens import Token, segment_basmala, segment_verse
from . import translations as translations_mod

PREVIOUS_VERSION = "0.5.0"

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
    # The morphology block (root, lemma, pos, features, segments) is an annotation
    # from the Leeds QAC, aligned onto the token — never derived from Tanzil. Its
    # provenance is the morphology source; it does not touch the text_* fields.
    "morphology": {"source_id": MORPHOLOGY_SOURCE_ID, "transform": ["align-leeds-qac"]},
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
    #: scheme id -> {(surah, slot): ordinal} for every counted segment.
    ordinal_maps: dict[str, dict[tuple[int, str], int]]


def assemble() -> Assembled:
    uthmani = parse_text(_read("tanzil-uthmani.txt"))
    simple = parse_text(_read("tanzil-simple.txt"))

    simple_by_key = {(v.surah, v.ayah): v.text for v in simple}
    if {(v.surah, v.ayah) for v in uthmani} != set(simple_by_key):
        raise ValueError("Uthmani and Simple editions disagree on the verse set")

    tokens: list[Token] = []
    basmala: dict[int, tuple[BasmalaSplit, BasmalaSplit]] = {}
    marks_excluded = 0

    # First pass: split off basmalas, tokenise, and record each surah's segments
    # in textual order so a numbering scheme can be applied over them. A separated
    # basmala precedes verse 1's own content in the source, so it heads the surah.
    verse_rows: list[dict[str, Any]] = []
    segments_by_surah: dict[int, list[Segment]] = {}

    for v in uthmani:
        simple_text = simple_by_key[(v.surah, v.ayah)]
        if v.ayah == 1:
            u_split = split_uthmani(v.surah, v.text)
            s_split = split_simple(v.surah, simple_text)
            basmala[v.surah] = (u_split, s_split)
            u_text, s_text = u_split.verse_one, s_split.verse_one
            surah_segments = segments_by_surah.setdefault(v.surah, [])
            if u_split.separated:
                surah_segments.append(
                    Segment(v.surah, BASMALA_SLOT, BASMALA_KIND)
                )
        else:
            u_text, s_text = v.text, simple_text
            surah_segments = segments_by_surah.setdefault(v.surah, [])

        slot = str(v.ayah)
        surah_segments.append(Segment(v.surah, slot, VERSE_KIND))

        seg = segment_verse(v.surah, slot, u_text)
        marks_excluded += seg.marks_excluded
        tokens.extend(seg.tokens)
        verse_rows.append(
            {
                "id": segment_id(v.surah, slot),
                "work_id": WORK_ID,
                "source_id": SEGMENTATION_SOURCE_ID,
                "surah": v.surah,
                "slot": slot,
                **derive_text_fields(u_text, s_text),
                "leading_marks": seg.leading_marks,
            }
        )

    for surah, (u_split, _s_split) in basmala.items():
        if u_split.separated and u_split.basmala is not None:
            seg = segment_basmala(surah, u_split.basmala)
            tokens.extend(seg.tokens)

    # Apply every available numbering scheme as data. Ordinals are an attribute of
    # a segment under a scheme, never part of its identity.
    ordinal_maps = {s.id: assign_ordinals(s, segments_by_surah) for s in SCHEMES}

    # verses.jsonl holds the segments the *active* scheme numbers. Each carries its
    # ordinal under every scheme that counts it, keyed by scheme id.
    active = ordinal_maps[DEFAULT_SCHEME_ID]
    verses: list[dict[str, Any]] = []
    for row in verse_rows:
        key = (row["surah"], row["slot"])
        if key not in active:
            continue
        ordinals = {
            sid: omap[key] for sid, omap in ordinal_maps.items() if key in omap
        }
        verses.append(
            {
                "id": row["id"],
                "work_id": row["work_id"],
                "source_id": row["source_id"],
                "surah": row["surah"],
                "slot": row["slot"],
                "ordinals": ordinals,
                "text_uthmani": row["text_uthmani"],
                "text_simple": row["text_simple"],
                "text_no_tashkeel": row["text_no_tashkeel"],
                "text_normalised": row["text_normalised"],
                "leading_marks": row["leading_marks"],
            }
        )

    tokens.sort(key=lambda t: (t.surah, ordinal_sort_key(t, active), t.position))
    token_records = [t.record() for t in tokens]
    return Assembled(verses, token_records, basmala, marks_excluded, ordinal_maps)


def ordinal_sort_key(token: Token, active: dict[tuple[int, str], int]) -> tuple[int, int]:
    """Sort tokens into reading order using the active scheme's ordinals.

    A named-slot segment (the separated basmala) has no ordinal but sits at the
    head of its surah in the source, so it sorts before ordinal 1. Returned as
    ``(has_ordinal, ordinal)`` — named slots get ``(0, 0)``, verses ``(1, n)``.
    """
    ordinal = active.get((token.surah, token.slot))
    if ordinal is None:
        return (0, 0)
    return (1, ordinal)


def _basmala_field(
    surah: int, split_pair: tuple[BasmalaSplit, BasmalaSplit] | None
) -> dict[str, Any] | None:
    if split_pair is None:  # surah 9 — no basmala, explicitly absent.
        return None
    u_split, _ = split_pair
    if u_split.basmala is None:
        return None

    n = len(u_split.basmala.split(" "))
    # A separated basmala uses the named ``basmala`` slot; al-Fatiha's basmala is
    # verse 1 and uses the ordinal slot "1".
    slot = BASMALA_SLOT if u_split.separated else "1"
    return {
        "separated": u_split.separated,
        **derive_token_fields(u_split.basmala),
        "token_range": {
            "slot": slot,
            "first_id": token_id(surah, slot, 1),
            "last_id": token_id(surah, slot, n),
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


@dataclass
class ProcessedTranslations:
    #: sources.json records, one per edition (licence, translator, year, checksum).
    source_records: list[dict[str, Any]]
    #: edition id -> verse-level lines (one per counted verse).
    lines_by_id: dict[str, list[dict[str, Any]]]
    #: edition id -> line count.
    line_counts: dict[str, int]
    #: edition id -> per-edition LICENSE text.
    licence_files: dict[str, str]


def process_translations(verses: list[dict[str, Any]]) -> ProcessedTranslations:
    """Parse each licensed edition, align it verse-by-verse onto the corpus, and
    assemble its source record, lines and licence file. Alignment is asserted
    exact — a partial or drifted edition raises rather than shipping silently."""
    source_records: list[dict[str, Any]] = []
    lines_by_id: dict[str, list[dict[str, Any]]] = {}
    line_counts: dict[str, int] = {}
    licence_files: dict[str, str] = {}
    for t in translations_mod.TRANSLATIONS:
        raw = (SOURCES_DIR / t.filename).read_text(encoding="utf-8")
        edition = translations_mod.parse_edition(raw)
        lines = translations_mod.build_lines(edition, verses, t.id)
        source_records.append(
            translations_mod.source_record(t, sha256_file(SOURCES_DIR / t.filename))
        )
        lines_by_id[t.id] = lines
        line_counts[t.id] = len(lines)
        licence_files[t.id] = translations_mod.licence_file(t)
    return ProcessedTranslations(source_records, lines_by_id, line_counts, licence_files)


def build_identifiers() -> dict[str, Any]:
    return {
        "scheme": SEGMENTATION_SOURCE_ID,
        "format": IDENTIFIER_FORMAT,
        "components": ["work", "scheme", "surah", "segment", "position"],
        "position_1_based": True,
        "segment_slot": {
            "detail": (
                "The <segment> component addresses a segment within a surah. It is "
                "one of two kinds, both first-class parts of this scheme."
            ),
            "ordinal": {
                "detail": (
                    "A decimal ordinal ayah number, e.g. 43 in "
                    "quran:tanzil-uthmani:2:43. Ordinary verses use ordinal slots. "
                    "The ordinal corresponds to the active numbering scheme (see "
                    "manifest.numbering); it is an attribute, not the identity — a "
                    "different scheme may number the same segment differently."
                ),
                "example": "quran:tanzil-uthmani:2:43:4",
            },
            "named_slots": {
                "detail": (
                    "A named, non-ordinal slot. A named slot asserts no counting "
                    "position, so no numbering tradition is baked into the identifier."
                ),
                "slots": {
                    BASMALA_SLOT: (
                        "The separated surah-opening basmala, e.g. "
                        "quran:tanzil-uthmani:2:basmala:1. Deliberately not numbered: "
                        "whether it is a verse, and if so which, is left to each "
                        "numbering scheme as data. Al-Fatiha's basmala is verse 1:1 "
                        "and uses an ordinal slot, not this named slot; surah 9 has "
                        "no basmala and therefore no such slot."
                    ),
                },
            },
        },
        "guarantees": {
            "opaque_and_permanent": True,
            "position_is_attribute_not_identity": True,
            "detail": (
                "The identity string encodes (surah, segment, position) under a "
                "named segmentation scheme, but the ordinal number a segment carries "
                "is an attribute of the token, not its identity. A token that moves, "
                "splits or merges in a later corpus version receives an explicit "
                "successor or tombstone in mapping/."
            ),
        },
        "basmala_note": (
            "A separated surah-opening basmala is addressed by the named 'basmala' "
            "slot, never an ordinal. Al-Fatiha's basmala is verse 1:1. Surah 9 has "
            "no basmala segment."
        ),
    }


def _build_mapping() -> dict[str, Any]:
    """The v0.5.0 -> v0.6.0 identifier mapping: a pure identity.

    v0.6.0 adds verse-level translation editions. Translations align to existing
    verse ids (an identity mapping) and never touch tokens; token and verse ids,
    positions and surface text are unchanged. No id moves, so there are no explicit
    entries: every prior id resolves to itself by the identity default.
    """
    return {
        "from_version": PREVIOUS_VERSION,
        "to_version": CORPUS_VERSION,
        "note": (
            "Verse-level translations release: licensed translation editions were "
            "added, each aligned to existing verse ids. No token or verse "
            "identifier changed, so no id is remapped and every prior id resolves "
            "to itself."
        ),
        "default_resolution": "identity",
        "default_resolution_note": (
            f"Every v{PREVIOUS_VERSION} id is unchanged in v{CORPUS_VERSION} and "
            "resolves to itself. No ids changed form, so 'mappings' is empty. This "
            "makes the mapping total: every prior id resolves to exactly one "
            "successor (itself)."
        ),
        "mappings": [],
    }


def _mapping_schema() -> dict[str, Any]:
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "corpus identifier version mapping",
        "description": (
            "Maps prior-version identifiers to their successors. Only ids whose "
            "form changed are listed; per 'default_resolution', any id absent from "
            "'mappings' is unchanged and resolves to itself, so the mapping is "
            "total over the prior version's identifiers."
        ),
        "type": "object",
        "required": ["from_version", "to_version", "default_resolution", "mappings"],
        "properties": {
            "from_version": {"type": "string"},
            "to_version": {"type": "string"},
            "note": {"type": "string"},
            "default_resolution": {
                "enum": ["identity"],
                "description": (
                    "How to resolve a prior-version id not present in 'mappings'. "
                    "'identity' means it is unchanged and maps to itself."
                ),
            },
            "default_resolution_note": {"type": "string"},
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


def build_numbering(
    ordinal_maps: dict[str, dict[tuple[int, str], int]],
) -> dict[str, Any]:
    return {
        "active": DEFAULT_SCHEME_ID,
        "default": DEFAULT_SCHEME_ID,
        "available": [s.id for s in SCHEMES],
        "verse_counts": {sid: len(omap) for sid, omap in ordinal_maps.items()},
        "note": (
            "Numbering is a recorded parameter, not a fact baked into identifiers. "
            "Each scheme is a data file in numbering/; the active scheme's counted "
            "segments are the rows of verses.jsonl. See docs/numbering.md."
        ),
    }


def build_manifest(
    sources: list[dict[str, Any]],
    surahs: list[dict[str, Any]],
    verses: list[dict[str, Any]],
    tokens: list[dict[str, Any]],
    basmala: dict[int, tuple[BasmalaSplit, BasmalaSplit]],
    marks_excluded: int,
    ordinal_maps: dict[str, dict[tuple[int, str], int]],
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
        "numbering": build_numbering(ordinal_maps),
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


def _numbering_schema() -> dict[str, Any]:
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "verse numbering scheme",
        "description": (
            "A numbering scheme as data: how a counting tradition assigns ordinal "
            "verse numbers to a surah's segments. A new tradition is a new file of "
            "this shape in numbering/, consumed by the same generic applier — never "
            "new code. See docs/numbering.md."
        ),
        "type": "object",
        "required": ["id", "name", "source", "is_default", "rules"],
        "properties": {
            "id": {"type": "string"},
            "name": {"type": "string"},
            "full_name": {"type": "string"},
            "source": {
                "type": "object",
                "description": "Bibliographic citation for the tradition.",
            },
            "is_default": {"type": "boolean"},
            "note": {"type": "string"},
            "rules": {
                "type": "object",
                "required": ["order", "reset_per", "start_at", "counts"],
                "properties": {
                    "order": {"enum": ["textual"]},
                    "reset_per": {"enum": ["surah"]},
                    "start_at": {"type": "integer"},
                    "counts": {
                        "type": "object",
                        "description": (
                            "segment kind -> whether this scheme counts it as a verse"
                        ),
                        "additionalProperties": {"type": "boolean"},
                    },
                },
            },
        },
    }


def _write_json(path: Path, data: Any) -> None:
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


MANIFEST_NAME = "manifest.json"


def compute_output_checksums(out_dir: Path, version: str) -> dict[str, dict[str, Any]]:
    """sha256 + byte size for every emitted artifact, keyed by POSIX-relative
    path, excluding the manifest itself (a manifest cannot checksum its own final
    bytes) and the derived full-dataset tarball + sidecar (which embed the manifest,
    so listing them here would be circular). This is what lets a third party verify
    a published corpus byte-for-byte.
    """
    checksums: dict[str, dict[str, Any]] = {}
    for path in sorted(out_dir.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(out_dir).as_posix()
        if rel == MANIFEST_NAME or is_distribution_file(rel, version):
            continue
        data = path.read_bytes()
        checksums[rel] = {"sha256": sha256_bytes(data), "bytes": len(data)}
    return checksums


MORPHOLOGY_DIR = "morphology"


def _morphology_manifest(summary: dict[str, Any]) -> dict[str, Any]:
    """The manifest's morphology block: what was ingested, how it aligned, and the
    licence consequence — so a reader knows the provenance and copyleft from the
    manifest alone."""
    return {
        "source_id": MORPHOLOGY_SOURCE_ID,
        "layer": "annotation",
        "note": (
            "Leeds Quranic Arabic Corpus morphology (via the mustafa0x fork of QAC "
            "v0.4), aligned onto tokens as an annotation. Token ids, positions and "
            "surface text are unchanged. root is the spaced-Arabic form; root_slug is "
            "its URL transliteration; per-field provenance is token_field_provenance."
        ),
        "licence": "GPL-2.0-or-later",
        "licence_note": (
            "This data is GPL. Any artifact carrying it (tokens.jsonl, "
            "morphology/roots.json) is therefore GPL-2.0-or-later. The underlying "
            "Tanzil text remains available under CC-BY in verses.jsonl and the "
            "token text_* fields. See docs/licensing.md and morphology/ATTRIBUTION.md."
        ),
        "alignment": {
            "leeds_words": summary["leeds_words"],
            "aligned_leeds_words": summary["aligned_leeds_words"],
            "align_rate": round(summary["align_rate"], 6),
            "exact": summary["exact"],
            "normalised": summary["normalised"],
            "extended": summary["extended"],
            "merged_words": summary["merged_words"],
            "basmala_copied": summary["basmala_copied"],
            "failed": summary["failed"],
            "unaligned_our": summary["unaligned_our"],
        },
        "roots": {
            "distinct": summary["distinct_roots"],
            "tokens_with_root": summary["tokens_with_root"],
            "tokens_without_root": summary["tokens_without_root"],
            "artifact": f"{MORPHOLOGY_DIR}/roots.json",
        },
        "report": f"{MORPHOLOGY_DIR}/alignment-report.md",
    }


def _attribution_md(sources: list[dict[str, Any]]) -> str:
    m = next(s for s in sources if s["id"] == MORPHOLOGY_SOURCE_ID)
    return (
        "# Attribution — morphology\n\n"
        "The morphological annotation in this corpus (the `morphology` block on each "
        "token in `tokens.jsonl`, and `roots.json`) is derived from the **Quranic "
        "Arabic Corpus** (QAC).\n\n"
        "- **Original work:** Quranic Arabic Corpus, morphology release v0.4\n"
        "- **Author:** Kais Dukes\n"
        "- **Publisher:** Language Research Group, University of Leeds\n"
        "- **Original URL:** http://corpus.quran.com/\n"
        "- **Licence:** GNU General Public License (GPL) — see `LICENSE` in this "
        "directory (GPL-2.0-or-later).\n\n"
        "It was ingested via a GPL redistribution that converts the QAC's Buckwalter "
        "transliteration to Arabic script and applies documented corrections:\n\n"
        f"- **Redistribution:** {m['name']}\n"
        "- **Repository:** https://github.com/mustafa0x/quran-morphology\n"
        "- **Pinned commit:** `8f38b39016824284f9ed16ae15069ff9102c4acf`\n"
        f"- **File:** `quran-morphology.txt`\n"
        f"- **SHA-256:** `{m['sha256']}`\n\n"
        "The list of changes the fork makes to the original QAC is recorded in that "
        "repository's `README.md` and `scripts/apply-changes.py`.\n\n"
        "## What a redistributor must do\n\n"
        "Because this data is GPL, it carries copyleft: if you redistribute the "
        "morphology (or any file that embeds it), you must do so under the GPL, keep "
        "this attribution and licence, and make the corresponding source form "
        "available. The alignment onto quranbench token ids is performed by "
        "`packages/corpus-build/pipeline/morphology.py`. See `docs/licensing.md`.\n"
    )


def _write_morphology(
    out_dir: Path,
    sources: list[dict[str, Any]],
    roots_records: list[dict[str, Any]],
    report_md: str,
) -> None:
    morph_dir = out_dir / MORPHOLOGY_DIR
    morph_dir.mkdir(parents=True, exist_ok=True)
    _write_json(morph_dir / "roots.json", roots_records)
    (morph_dir / "LICENSE").write_text(
        (DATA_DIR / "GPL-2.0.txt").read_text(encoding="utf-8"), encoding="utf-8"
    )
    (morph_dir / "ATTRIBUTION.md").write_text(_attribution_md(sources), encoding="utf-8")
    (morph_dir / "alignment-report.md").write_text(report_md, encoding="utf-8")


def _write_translations(out_dir: Path, processed: ProcessedTranslations) -> None:
    """Emit one ``<edition>.jsonl`` and one ``<edition>.LICENSE.md`` per edition
    under ``translations/`` — so a downloader can take only the editions they can
    use, each with its own licence alongside it."""
    trans_dir = out_dir / translations_mod.TRANSLATIONS_DIR
    trans_dir.mkdir(parents=True, exist_ok=True)
    for edition_id, lines in processed.lines_by_id.items():
        _write_jsonl(trans_dir / f"{edition_id}.jsonl", lines)
        (trans_dir / f"{edition_id}.LICENSE.md").write_text(
            processed.licence_files[edition_id], encoding="utf-8"
        )


def build(out_root: Path = OUT_DIR) -> Path:
    fetch_all()

    assembled = assemble()

    # Morphology is an annotation layer: align the Leeds QAC onto the assembled
    # tokens and attach a `morphology` block to each. Token ids/positions/text are
    # untouched — a fact asserted by tests. Alignment is verified, and every
    # divergence enumerated in the emitted report.
    blocks, roots_records, stats = annotate(assembled.tokens, _read("quran-morphology.txt"))
    for token in assembled.tokens:
        token["morphology"] = blocks[token["id"]]
    summary = report_stats(stats, roots_records)
    report_md = render_report(stats, roots_records)

    # Verse-level translation editions (v0.6.0). Parsed and aligned onto the
    # already-assembled verse rows by verse id — an identity mapping that never
    # touches tokens. Their source records join sources.json alongside the corpus
    # sources so every ingested edition is recorded with licence and checksum.
    processed_translations = process_translations(assembled.verses)

    surahs = build_surah_records(assembled.verses, assembled.basmala)
    sources = build_source_records() + processed_translations.source_records
    manifest = build_manifest(
        sources,
        surahs,
        assembled.verses,
        assembled.tokens,
        assembled.basmala,
        assembled.marks_excluded,
        assembled.ordinal_maps,
    )
    manifest["morphology"] = _morphology_manifest(summary)
    manifest["translations"] = translations_mod.manifest_block(
        processed_translations.source_records, processed_translations.line_counts
    )

    out_dir = out_root / f"v{CORPUS_VERSION}"
    (out_dir / "mapping").mkdir(parents=True, exist_ok=True)
    (out_dir / "numbering").mkdir(parents=True, exist_ok=True)
    _write_translations(out_dir, processed_translations)
    _write_json(out_dir / "sources.json", sources)
    _write_json(out_dir / "surahs.json", surahs)
    _write_jsonl(out_dir / "verses.jsonl", assembled.verses)
    _write_jsonl(out_dir / "tokens.jsonl", assembled.tokens)
    _write_json(out_dir / "identifiers.json", build_identifiers())
    _write_json(out_dir / "mapping" / "mapping.schema.json", _mapping_schema())
    _write_json(
        out_dir / "mapping" / f"v{PREVIOUS_VERSION}-to-v{CORPUS_VERSION}.json",
        _build_mapping(),
    )
    _write_json(out_dir / "numbering" / "numbering.schema.json", _numbering_schema())
    for scheme in SCHEMES:
        _write_json(out_dir / "numbering" / f"{scheme.id}.json", scheme.record())
    _write_morphology(out_dir, sources, roots_records, report_md)

    # Every non-manifest artifact is now on disk; checksum them and record the
    # block in the manifest, written last so it can cover the final bytes of all
    # its siblings. The manifest excludes itself.
    manifest["checksums"] = compute_output_checksums(out_dir, CORPUS_VERSION)
    _write_json(out_dir / MANIFEST_NAME, manifest)

    # Finally, the full-dataset distribution tarball. Built after the manifest so
    # the archive contains it; self-described by a .sha256 sidecar rather than the
    # manifest (see pipeline/tarball.py).
    write_full_tarball(out_dir, CORPUS_VERSION)

    print(
        f"built {out_dir}\n"
        f"  surahs={manifest['counts']['surahs']} "
        f"verses={manifest['counts']['verses']} "
        f"tokens={manifest['counts']['tokens']}\n"
        f"  numbering active={manifest['numbering']['active']} "
        f"verse_counts={manifest['numbering']['verse_counts']}\n"
        f"  basmala separated from {manifest['basmala']['separated_from_surahs']} surahs\n"
        f"  waqf marks excluded: {manifest['token_segmentation']['waqf_marks_excluded']}\n"
        f"  morphology: {summary['distinct_roots']} roots, "
        f"{summary['aligned_leeds_words']}/{summary['leeds_words']} Leeds words aligned "
        f"({100 * summary['align_rate']:.4f}%), "
        f"{summary['tokens_without_root']} tokens with no root\n"
        f"  translations: {len(processed_translations.line_counts)} editions "
        f"({', '.join(processed_translations.line_counts)})"
    )
    return out_dir


def main() -> int:
    build()
    return 0


if __name__ == "__main__":
    sys.exit(main())
