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
    for name in (
        "sources.json",
        "surahs.json",
        "verses.jsonl",
        "tokens.jsonl",
        "identifiers.json",
        "manifest.json",
        "mapping/mapping.schema.json",
        "mapping/v0.1.0-to-v0.2.0.json",
    ):
        assert (artifacts / name).exists(), name
    assert artifacts.name == "v0.2.0"


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
        "leading_marks",
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
    assert manifest["corpus_version"] == "0.2.0"
    assert manifest["work_id"] == "quran"
    assert manifest["segmentation_scheme"] == "tanzil-uthmani"
    assert manifest["counts"]["surahs"] == 114
    assert manifest["counts"]["verses"] == 6236
    assert manifest["counts"]["tokens"] > 0
    assert "built_at" in manifest


def test_manifest_records_basmala_handling(artifacts: Path) -> None:
    manifest = _read_json(artifacts / "manifest.json")
    assert manifest["basmala_handling"] == "separated"
    b = manifest["basmala"]
    assert b["separated_from_surahs"] == 112
    assert b["no_basmala_surahs"] == [9]
    assert b["basmala_is_verse_surahs"] == [1]
    # The canonical basmala string is recorded and is the Uthmani standard form.
    assert b["canonical"].startswith("بِس")  # بِس
    assert manifest["token_segmentation"]["waqf_marks_excluded"] > 0

    manifest_sha = {s["id"]: s["sha256"] for s in manifest["sources"]}
    sources_sha = {s["id"]: s["sha256"] for s in _read_json(artifacts / "sources.json")}
    assert manifest_sha == sources_sha

    rule_ids = {r["id"] for r in manifest["normalisation_rules"]}
    assert rule_ids == {r.id for r in NORMALISATION_RULES}
    for rule in manifest["normalisation_rules"]:
        assert rule["description"]
        assert rule["applies_to"]
        assert rule["detail"]


def test_surah_basmala_field(artifacts: Path) -> None:
    surahs = {s["number"]: s for s in _read_json(artifacts / "surahs.json")}

    # Surah 9 has no basmala — explicitly absent, not an empty string.
    assert surahs[9]["basmala"] is None

    # Al-Fatiha's basmala is verse 1:1 and is not separated.
    assert surahs[1]["basmala"] is not None
    assert surahs[1]["basmala"]["separated"] is False
    assert surahs[1]["basmala"]["token_range"]["ayah"] == 1

    # A normal surah: basmala separated, addressed as ayah 0, four labelled forms.
    b2 = surahs[2]["basmala"]
    assert b2["separated"] is True
    assert b2["token_range"] == {
        "ayah": 0,
        "first_id": "quran:tanzil-uthmani:2:0:1",
        "last_id": "quran:tanzil-uthmani:2:0:4",
        "count": 4,
    }
    for field in ("text_uthmani", "text_simple", "text_no_tashkeel", "text_normalised"):
        assert b2[field]

    separated = [n for n, s in surahs.items() if s["basmala"] and s["basmala"]["separated"]]
    assert len(separated) == 112


def test_identifiers_policy_is_machine_readable(artifacts: Path) -> None:
    ids = _read_json(artifacts / "identifiers.json")
    assert ids["scheme"] == "tanzil-uthmani"
    assert ids["format"] == "quran:tanzil-uthmani:<surah>:<ayah>:<position>"
    # Position is an attribute, not identity — the guarantee must be stated.
    assert ids["guarantees"]["position_is_attribute_not_identity"] is True
    assert ids["guarantees"]["opaque_and_permanent"] is True
    assert ids["basmala_ayah"] == 0


def test_mapping_scaffold_and_schema(artifacts: Path) -> None:
    schema = _read_json(artifacts / "mapping" / "mapping.schema.json")
    assert schema["type"] == "object"
    assert "mappings" in schema["properties"]

    scaffold = _read_json(artifacts / "mapping" / "v0.1.0-to-v0.2.0.json")
    assert scaffold["from_version"] == "0.1.0"
    assert scaffold["to_version"] == "0.2.0"
    assert scaffold["mappings"] == []  # empty scaffold, populated by a future change


def test_manifest_verse_fields_traceable_to_a_source(artifacts: Path) -> None:
    manifest = _read_json(artifacts / "manifest.json")
    provenance = manifest["field_provenance"]
    source_ids = {s["id"] for s in _read_json(artifacts / "sources.json")}
    for field in ("text_uthmani", "text_simple", "text_no_tashkeel", "text_normalised"):
        assert provenance[field]["source_id"] in source_ids
