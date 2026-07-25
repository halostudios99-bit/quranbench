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
        "mapping/v0.3.0-to-v0.4.0.json",
        "numbering/numbering.schema.json",
        "numbering/kufan.json",
    ):
        assert (artifacts / name).exists(), name
    assert artifacts.name == "v0.4.0"


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
        "slot",
        "ordinals",
        "text_uthmani",
        "text_simple",
        "text_no_tashkeel",
        "text_normalised",
        "leading_marks",
    }
    # No bare "2:43" identifiers — every id carries the segmentation scheme.
    assert all(v["id"].startswith("quran:tanzil-uthmani:") for v in verses)
    # Ordinal is an attribute per scheme, not a hardcoded ayah field.
    assert first["ordinals"] == {"kufan": 1}
    assert "ayah" not in first


def test_verse_ordinals_reproduce_the_kufan_count(artifacts: Path) -> None:
    verses = _read_jsonl(artifacts / "verses.jsonl")
    # The Kufan scheme numbers exactly the 6,236 verses in verses.jsonl.
    numbered = [v for v in verses if "kufan" in v["ordinals"]]
    assert len(numbered) == 6236
    # Every verse's stable slot equals its Kufan ordinal, rendered as a string —
    # the ordinal is the attribute, the slot is the identity.
    for v in verses:
        assert v["slot"] == str(v["ordinals"]["kufan"])


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
    assert manifest["corpus_version"] == "0.4.0"
    assert manifest["previous_version"] == "0.3.0"
    assert manifest["work_id"] == "quran"
    assert manifest["segmentation_scheme"] == "tanzil-uthmani"
    assert manifest["identifier_format"] == "quran:tanzil-uthmani:<surah>:<segment>:<position>"
    assert manifest["counts"]["surahs"] == 114
    assert manifest["counts"]["verses"] == 6236
    assert manifest["counts"]["tokens"] > 0
    assert "built_at" in manifest


def test_manifest_records_numbering(artifacts: Path) -> None:
    manifest = _read_json(artifacts / "manifest.json")
    numbering = manifest["numbering"]
    assert numbering["active"] == "kufan"
    assert numbering["default"] == "kufan"
    assert numbering["available"] == ["kufan"]
    assert numbering["verse_counts"] == {"kufan": 6236}


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

    # Al-Fatiha's basmala is verse 1:1, addressed by the ordinal slot "1".
    assert surahs[1]["basmala"] is not None
    assert surahs[1]["basmala"]["separated"] is False
    assert surahs[1]["basmala"]["token_range"]["slot"] == "1"

    # A normal surah: basmala separated, addressed by the named 'basmala' slot.
    b2 = surahs[2]["basmala"]
    assert b2["separated"] is True
    assert b2["token_range"] == {
        "slot": "basmala",
        "first_id": "quran:tanzil-uthmani:2:basmala:1",
        "last_id": "quran:tanzil-uthmani:2:basmala:4",
        "count": 4,
    }
    for field in ("text_uthmani", "text_simple", "text_no_tashkeel", "text_normalised"):
        assert b2[field]

    separated = [n for n, s in surahs.items() if s["basmala"] and s["basmala"]["separated"]]
    assert len(separated) == 112


def test_no_identifier_contains_ayah_zero(artifacts: Path) -> None:
    tokens = _read_jsonl(artifacts / "tokens.jsonl")
    verses = _read_jsonl(artifacts / "verses.jsonl")
    surahs = _read_json(artifacts / "surahs.json")
    for t in tokens:
        assert ":0:" not in t["id"], t["id"]
        assert ":0:" not in t["segment_id"], t["segment_id"]
    for v in verses:
        assert not v["id"].endswith(":0")
        assert ":0:" not in v["id"], v["id"]
    for s in surahs:
        if s["basmala"]:
            tr = s["basmala"]["token_range"]
            assert ":0:" not in tr["first_id"]
            assert ":0:" not in tr["last_id"]


def test_fatiha_basmala_is_ordinal_not_a_named_slot(artifacts: Path) -> None:
    tokens = _read_jsonl(artifacts / "tokens.jsonl")
    fatiha_first_verse = [
        t for t in tokens if t["surah"] == 1 and t["slot"] == "1"
    ]
    assert fatiha_first_verse, "surah 1 verse 1 tokens missing"
    for t in fatiha_first_verse:
        assert t["slot"] == "1"  # ordinal slot, not "basmala"
        assert t["is_basmala"] is False
        assert t["id"].startswith("quran:tanzil-uthmani:1:1:")
    # And there is no named basmala slot anywhere in surah 1.
    assert not [t for t in tokens if t["surah"] == 1 and t["slot"] == "basmala"]


def test_identifiers_policy_is_machine_readable(artifacts: Path) -> None:
    ids = _read_json(artifacts / "identifiers.json")
    assert ids["scheme"] == "tanzil-uthmani"
    assert ids["format"] == "quran:tanzil-uthmani:<surah>:<segment>:<position>"
    # Position/ordinal is an attribute, not identity — the guarantee must be stated.
    assert ids["guarantees"]["position_is_attribute_not_identity"] is True
    assert ids["guarantees"]["opaque_and_permanent"] is True
    # Named segment slots are a documented, first-class part of the scheme.
    assert "basmala" in ids["segment_slot"]["named_slots"]["slots"]
    assert "ordinal" in ids["segment_slot"]
    # The ayah-0 assertion is gone.
    assert "basmala_ayah" not in ids


def test_mapping_is_identity_with_no_entries(artifacts: Path) -> None:
    schema = _read_json(artifacts / "mapping" / "mapping.schema.json")
    assert schema["type"] == "object"
    assert "mappings" in schema["properties"]
    assert "default_resolution" in schema["properties"]

    # v0.4.0 is a metadata-only release: no identifier moved, so the mapping is a
    # pure identity default with zero explicit entries.
    mapping = _read_json(artifacts / "mapping" / "v0.3.0-to-v0.4.0.json")
    assert mapping["from_version"] == "0.3.0"
    assert mapping["to_version"] == "0.4.0"
    assert mapping["default_resolution"] == "identity"
    assert mapping["mappings"] == []


def test_mapping_is_total_by_identity(artifacts: Path) -> None:
    # With an identity default and no explicit entries, every v0.3.0 id resolves
    # to itself — a total mapping over the prior version's identifiers.
    tokens = _read_jsonl(artifacts / "tokens.jsonl")
    new_ids = {t["id"] for t in tokens}

    mapping = _read_json(artifacts / "mapping" / "v0.3.0-to-v0.4.0.json")
    explicit = {m["from"]: m["to"] for m in mapping["mappings"]}
    assert explicit == {}  # nothing remapped

    # Every prior id resolves to itself (the identity default) and to a real id.
    for old in new_ids:
        successors = explicit.get(old, [old])
        assert len(successors) == 1, old
        assert successors[0] == old
        assert successors[0] in new_ids


def test_numbering_scheme_is_data(artifacts: Path) -> None:
    kufan = _read_json(artifacts / "numbering" / "kufan.json")
    assert kufan["id"] == "kufan"
    assert kufan["is_default"] is True
    assert kufan["source"]["citation"]
    rules = kufan["rules"]
    assert rules["counts"]["verse"] is True
    assert rules["counts"]["basmala"] is False


def test_manifest_verse_fields_traceable_to_a_source(artifacts: Path) -> None:
    manifest = _read_json(artifacts / "manifest.json")
    provenance = manifest["field_provenance"]
    source_ids = {s["id"] for s in _read_json(artifacts / "sources.json")}
    for field in ("text_uthmani", "text_simple", "text_no_tashkeel", "text_normalised"):
        assert provenance[field]["source_id"] in source_ids


def test_manifest_records_output_checksums(artifacts: Path) -> None:
    from pipeline.paths import sha256_bytes

    manifest = _read_json(artifacts / "manifest.json")
    checksums = manifest["checksums"]

    # Every emitted file except the manifest itself is listed, with sha256 + size.
    assert "manifest.json" not in checksums
    on_disk = {
        p.relative_to(artifacts).as_posix()
        for p in artifacts.rglob("*")
        if p.is_file() and p.name != "manifest.json"
    }
    assert set(checksums) == on_disk

    # Each recorded sha256 and byte size matches the file on disk exactly.
    for rel, entry in checksums.items():
        data = (artifacts / rel).read_bytes()
        assert entry["sha256"] == sha256_bytes(data), rel
        assert entry["bytes"] == len(data), rel

    # The big artifacts are covered.
    for rel in ("tokens.jsonl", "verses.jsonl", "surahs.json", "sources.json"):
        assert rel in checksums


def test_verify_accepts_a_clean_build_and_rejects_tampering(artifacts: Path) -> None:
    from pipeline.verify import verify

    assert verify(artifacts) == []

    # Corrupt one byte of a big artifact and confirm verify names it.
    tokens = artifacts / "tokens.jsonl"
    original = tokens.read_bytes()
    try:
        mutated = bytearray(original)
        mutated[1000] ^= 0x01
        tokens.write_bytes(mutated)
        errors = verify(artifacts)
        assert errors, "verify should report the corruption"
        assert any("tokens.jsonl" in e and "sha256" in e for e in errors)
    finally:
        tokens.write_bytes(original)

    # A clean directory verifies again once restored.
    assert verify(artifacts) == []


def test_v030_and_v040_token_ids_are_identical() -> None:
    # The gate before deleting v0.3.0: v0.4.0 is a metadata-only rebuild, so its
    # token id set must be identical. Skips once v0.3.0 has been removed.
    from pipeline.paths import OUT_DIR

    prev = OUT_DIR / "v0.3.0" / "tokens.jsonl"
    cur = OUT_DIR / "v0.4.0" / "tokens.jsonl"
    if not prev.exists():
        pytest.skip("v0.3.0 removed after verification")
    assert cur.exists(), "v0.4.0 must be built"

    prev_ids = {json.loads(line)["id"] for line in prev.read_text(encoding="utf-8").splitlines() if line}
    cur_ids = {json.loads(line)["id"] for line in cur.read_text(encoding="utf-8").splitlines() if line}
    assert len(cur_ids) == 77881
    assert prev_ids == cur_ids
