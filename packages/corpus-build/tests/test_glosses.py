from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline import build as build_mod
from pipeline.glosses import (
    GlossAlignmentError,
    distinct_word_locations,
    load_word_annotations,
)
from pipeline.paths import SOURCES_DIR


def _src(name: str) -> str:
    path = SOURCES_DIR / name
    if not path.exists():
        pytest.skip(f"missing source {name}; run `python -m pipeline.fetch` first")
    return path.read_text(encoding="utf-8")


# ── unit: the positional join ────────────────────────────────────────────────
def test_distinct_word_locations_match_the_annotation_files() -> None:
    morph = _src("quran-morphology.txt")
    locs = distinct_word_locations(morph)
    assert len(locs) == 77429
    assert locs[0] == (1, 1, 1)
    assert locs[-1] == (114, 6, 3)


def test_load_word_annotations_aligns_1to1() -> None:
    ann = load_word_annotations(
        _src("quran-morphology.txt"),
        _src("qac-word-gloss.txt"),
        _src("qac-word-transliteration.txt"),
    )
    assert len(ann) == 77429
    assert ann[(1, 1, 1)].gloss == "In (the) name"
    assert ann[(1, 1, 1)].transliteration == "bis'mi"
    assert ann[(112, 1, 1)].gloss == "Say,"
    assert ann[(112, 1, 1)].transliteration == "qul"


def test_count_mismatch_refuses_rather_than_misaligns() -> None:
    morph = _src("quran-morphology.txt")
    with pytest.raises(GlossAlignmentError):
        load_word_annotations(morph, "one\ntwo\n", "a\nb\n")


# ── integration: the built corpus ────────────────────────────────────────────
@pytest.fixture(scope="module")
def artifacts(tmp_path_factory) -> Path:
    out_root = tmp_path_factory.mktemp("out")
    return build_mod.build(out_root=out_root)


def _tokens(artifacts: Path) -> list[dict]:
    return [
        json.loads(x)
        for x in (artifacts / "tokens.jsonl").read_text(encoding="utf-8").splitlines()
        if x
    ]


def _roots(artifacts: Path) -> list[dict]:
    return json.loads((artifacts / "morphology" / "roots.json").read_text(encoding="utf-8"))


def test_gloss_and_transliteration_present_for_aligned_tokens(artifacts: Path) -> None:
    by_id = {t["id"]: t for t in _tokens(artifacts)}
    m = by_id["quran:tanzil-uthmani:1:2:1"]["morphology"]  # الْحَمْدُ
    assert m["gloss"] == "All praises and thanks"
    assert m["gloss_source"] == "qac-word-gloss"
    assert m["transliteration"] == "al-ḥamdu"
    assert m["transliteration_source"] == "qac-word-transliteration"


def test_absent_is_none_not_empty_string(artifacts: Path) -> None:
    for t in _tokens(artifacts):
        m = t["morphology"]
        # Every field is present; where a value is missing it is None, never "".
        for key in ("gloss", "transliteration", "gloss_source", "transliteration_source"):
            assert key in m
            assert m[key] != "", (t["id"], key)


def test_separated_basmala_copies_its_gloss_from_al_fatiha(artifacts: Path) -> None:
    by_id = {t["id"]: t for t in _tokens(artifacts)}
    b = by_id["quran:tanzil-uthmani:2:basmala:1"]["morphology"]
    assert b["alignment"] == "basmala-copied"
    assert b["gloss"] == "In (the) name"
    assert b["transliteration"] == "bis'mi"


def test_root_occurrences_matches_roots_json(artifacts: Path) -> None:
    occ = {r["root_slug"]: r["occurrences"] for r in _roots(artifacts)}
    for t in _tokens(artifacts):
        m = t["morphology"]
        if m["root_slug"] is not None:
            assert m["root_occurrences"] == occ[m["root_slug"]], t["id"]
        else:
            assert m["root_occurrences"] is None


def test_gloss_does_not_change_token_ids_or_surface(artifacts: Path) -> None:
    from pipeline.paths import OUT_DIR

    prev = OUT_DIR / "v0.7.0" / "tokens.jsonl"
    if not prev.exists():
        pytest.skip("v0.7.0 not on disk")
    old = {
        json.loads(x)["id"]: json.loads(x)
        for x in prev.read_text(encoding="utf-8").splitlines()
        if x
    }
    for t in _tokens(artifacts):
        o = old[t["id"]]
        for field in ("surah", "slot", "position", "segment_id", "text_uthmani"):
            assert t[field] == o[field], (t["id"], field)


def test_coverage_is_complete(artifacts: Path) -> None:
    tokens = _tokens(artifacts)
    glossed = sum(1 for t in tokens if t["morphology"]["gloss"])
    translit = sum(1 for t in tokens if t["morphology"]["transliteration"])
    # Every token aligns to a Leeds word (directly or by basmala copy), so gloss
    # and transliteration cover the whole corpus and the computed fallback is unused.
    assert glossed == len(tokens)
    assert translit == len(tokens)
