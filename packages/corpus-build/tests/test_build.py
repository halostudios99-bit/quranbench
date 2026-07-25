from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline import build as build_mod
from pipeline.normalise import NORMALISATION_RULES


@pytest.fixture(scope="module")
def artifacts(tmp_path_factory) -> Path:
    out_root = tmp_path_factory.mktemp("out")
    return build_mod.build(out_root=out_root)


def _read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def test_writes_expected_files(artifacts: Path) -> None:
    for name in ("sources.json", "surahs.json", "verses.jsonl", "manifest.json"):
        assert (artifacts / name).exists(), name
    assert artifacts.name == "v0.1.0"


def test_verse_artifact_counts_and_ids(artifacts: Path) -> None:
    verses = _read_jsonl(artifacts / "verses.jsonl")
    assert len(verses) == 6236
    first = verses[0]
    assert first["id"] == "quran:tanzil-uthmani:1:1"
    assert first["work_id"] == "quran"
    assert first["source_id"] == "tanzil-uthmani"
    assert set(first) == {
        "id",
        "work_id",
        "source_id",
        "surah",
        "ayah",
        "text_uthmani",
        "text_simple",
        "text_no_tashkeel",
        "text_normalised",
    }
    # No bare "2:43" identifiers — every id carries the segmentation scheme.
    assert all(v["id"].startswith("quran:tanzil-uthmani:") for v in verses)


def test_surah_artifact(artifacts: Path) -> None:
    surahs = _read_json(artifacts / "surahs.json")
    assert len(surahs) == 114
    by_number = {s["number"]: s for s in surahs}
    assert by_number[1]["verse_count"] == 7
    assert by_number[2]["verse_count"] == 286
    assert by_number[114]["verse_count"] == 6
    assert by_number[1]["name_translit"] == "Al-Faatiha"
    assert by_number[1]["id"] == "quran:1"


def test_sources_artifact_matches_entity_model(artifacts: Path) -> None:
    sources = _read_json(artifacts / "sources.json")
    ids = {s["id"] for s in sources}
    assert {"tanzil-uthmani", "tanzil-simple", "tanzil-metadata"} <= ids
    for s in sources:
        for field in ("id", "name", "publisher", "edition", "url", "licence", "sha256"):
            assert field in s, field
        assert "year" in s
        assert len(s["sha256"]) == 64


def test_manifest_is_self_describing(artifacts: Path) -> None:
    manifest = _read_json(artifacts / "manifest.json")
    assert manifest["corpus_version"] == "0.1.0"
    assert manifest["work_id"] == "quran"
    assert manifest["segmentation_scheme"] == "tanzil-uthmani"
    assert manifest["counts"] == {"surahs": 114, "verses": 6236}
    assert "built_at" in manifest

    manifest_sha = {s["id"]: s["sha256"] for s in manifest["sources"]}
    sources_sha = {s["id"]: s["sha256"] for s in _read_json(artifacts / "sources.json")}
    assert manifest_sha == sources_sha

    rule_ids = {r["id"] for r in manifest["normalisation_rules"]}
    assert rule_ids == {r.id for r in NORMALISATION_RULES}
    for rule in manifest["normalisation_rules"]:
        assert rule["description"]
        assert rule["applies_to"]
        assert rule["detail"]


def test_manifest_verse_fields_traceable_to_a_source(artifacts: Path) -> None:
    manifest = _read_json(artifacts / "manifest.json")
    provenance = manifest["field_provenance"]
    source_ids = {s["id"] for s in _read_json(artifacts / "sources.json")}
    for field in ("text_uthmani", "text_simple", "text_no_tashkeel", "text_normalised"):
        assert provenance[field]["source_id"] in source_ids
