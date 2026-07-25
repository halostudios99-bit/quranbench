"""Translation ingest — licensing and alignment invariants.

The binding constraint: every ingested edition records whether it is
redistributable. A *redistributable* edition's licence must clearly permit open
redistribution; a *display-only* edition (served but excluded from downloads) must
be marked ``redistributable=False`` and its licence must be one we would not
redistribute. These tests fail the build if either invariant is violated, and
assert the verse-level alignment is exact and identity-mapped to the corpus verse
ids.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline import build as build_mod
from pipeline import translations as trans_mod
from pipeline.paths import OUT_DIR


@pytest.fixture(scope="module")
def artifacts(tmp_path_factory) -> Path:
    out_root = tmp_path_factory.mktemp("out")
    return build_mod.build(out_root=out_root)


def _read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]


def permits_redistribution(licence: str) -> bool:
    """A licence string that *clearly* permits redistribution in an open dataset.

    Public domain and permissive/attribution CC licences qualify. Anything
    carrying a NonCommercial (NC) or NoDerivatives (ND) restriction does not — an
    open, redistributable dataset cannot inherit those. An unknown string is
    rejected: permission is never inferred.
    """
    lc = licence.strip().lower()
    if "nc" in lc.replace("-", " ").split() or "nd" in lc.replace("-", " ").split():
        return False
    if "noncommercial" in lc or "noderiv" in lc:
        return False
    if lc in {"public domain", "cc0", "cc0-1.0"}:
        return True
    return lc.startswith("cc-by") and "nc" not in lc and "nd" not in lc


def test_every_ingested_edition_records_licence_and_redistributable(artifacts: Path) -> None:
    sources = _read_json(artifacts / "sources.json")
    editions = [s for s in sources if s["role"] == trans_mod.TRANSLATION_ROLE]
    assert editions, "at least one translation edition must be ingested"
    for e in editions:
        # A recorded licence string, the URL where it was verified, and a
        # human-readable basis are all mandatory — a test fails if any is missing.
        assert e.get("licence"), f"{e['id']} has no licence"
        assert e.get("licence_url"), f"{e['id']} has no licence_url"
        assert e.get("licence_note"), f"{e['id']} has no licence basis"
        assert e.get("translator"), f"{e['id']} has no translator"
        assert e.get("year"), f"{e['id']} has no year"
        assert e.get("sha256"), f"{e['id']} has no checksum"
        assert "redistributable" in e, f"{e['id']} has no redistributable flag"
        # The flag must be consistent with the licence: a redistributable edition's
        # licence clearly permits it; a display-only edition's clearly does not.
        if e["redistributable"]:
            assert permits_redistribution(e["licence"]), (
                f"{e['id']} is marked redistributable but licence '{e['licence']}' "
                "does not clearly permit redistribution"
            )
        else:
            assert not permits_redistribution(e["licence"]), (
                f"{e['id']} is display-only yet its licence '{e['licence']}' would "
                "permit redistribution — the flag should be True"
            )


def test_itani_is_included_but_display_only(artifacts: Path) -> None:
    # The one display-only edition this release adds: served to readers, checksummed,
    # but licensed CC BY-NC-ND (no redistribution).
    manifest = _read_json(artifacts / "manifest.json")
    editions = {e["id"]: e for e in manifest["translations"]["editions"]}
    assert "en-itani" in editions, "Itani must be served on the site"
    itani = editions["en-itani"]
    assert itani["redistributable"] is False
    assert "NC" in itani["licence"] and "ND" in itani["licence"]
    assert itani["artifact"] in manifest["checksums"]


def test_rejected_and_display_only_licences_are_actually_rejected() -> None:
    # The guard is real, not a rubber stamp: display-only and rejected licences
    # must fail it, and only genuinely-open licences pass.
    assert not permits_redistribution("CC BY-NC-ND 4.0")  # Itani / ClearQuran
    assert not permits_redistribution("© 1955 A. J. Arberry")
    assert not permits_redistribution("All rights reserved")
    assert not permits_redistribution("Unknown")
    assert permits_redistribution("Public Domain")
    assert permits_redistribution("CC-BY-4.0")


def test_editions_are_verse_level_and_identity_mapped(artifacts: Path) -> None:
    verses = _read_jsonl(artifacts / "verses.jsonl")
    verse_ids = [v["id"] for v in verses]
    verse_id_set = set(verse_ids)
    assert len(verse_ids) == 6236

    manifest = _read_json(artifacts / "manifest.json")
    assert manifest["translations"]["alignment"] == "verse-level"

    for edition in manifest["translations"]["editions"]:
        lines = _read_jsonl(artifacts / edition["artifact"])
        assert edition["verses"] == 6236
        assert len(lines) == 6236
        line_ids = [ln["id"] for ln in lines]
        # Identity mapping: every translation line id is a corpus verse id, exactly
        # once, and the whole verse set is covered — no fabricated ids, no gaps.
        assert set(line_ids) == verse_id_set
        assert len(set(line_ids)) == len(line_ids)
        for ln in lines:
            assert ln["text"].strip(), f"{edition['id']} {ln['id']} empty translation"


def test_each_edition_has_its_own_licence_file(artifacts: Path) -> None:
    manifest = _read_json(artifacts / "manifest.json")
    for edition in manifest["translations"]["editions"]:
        licence_path = artifacts / edition["licence_file"]
        assert licence_path.exists(), edition["licence_file"]
        text = licence_path.read_text(encoding="utf-8")
        assert edition["translator"] in text
        assert "verse-level" in text.lower()


def test_verse_and_token_ids_identical_to_previous_version() -> None:
    # Adding translations must not disturb any existing identifier. Compare the
    # committed current-version artifacts against the previous version.
    prev = OUT_DIR / f"v{build_mod.PREVIOUS_VERSION}"
    cur = OUT_DIR / f"v{build_mod.CORPUS_VERSION}"
    if not (prev / "verses.jsonl").exists():
        pytest.skip(f"v{build_mod.PREVIOUS_VERSION} removed after verification")
    for name in ("verses.jsonl", "tokens.jsonl"):
        prev_ids = {json.loads(x)["id"] for x in (prev / name).read_text(encoding="utf-8").splitlines() if x}
        cur_ids = {json.loads(x)["id"] for x in (cur / name).read_text(encoding="utf-8").splitlines() if x}
        assert prev_ids == cur_ids, name


def test_parse_edition_and_build_lines_are_exact() -> None:
    raw = json.dumps(
        {"quran": [{"chapter": 1, "verse": 1, "text": "one"}, {"chapter": 1, "verse": 2, "text": "two"}]}
    )
    edition = trans_mod.parse_edition(raw)
    assert edition == {(1, 1): "one", (1, 2): "two"}

    verses = [
        {"id": "quran:x:1:1", "surah": 1, "slot": "1", "ordinals": {"kufan": 1}},
        {"id": "quran:x:1:2", "surah": 1, "slot": "2", "ordinals": {"kufan": 2}},
    ]
    lines = trans_mod.build_lines(edition, verses, "test")
    assert [ln["text"] for ln in lines] == ["one", "two"]
    assert [ln["id"] for ln in lines] == ["quran:x:1:1", "quran:x:1:2"]


def test_build_lines_rejects_a_missing_verse() -> None:
    edition = {(1, 1): "one"}
    verses = [
        {"id": "quran:x:1:1", "surah": 1, "slot": "1", "ordinals": {}},
        {"id": "quran:x:1:2", "surah": 1, "slot": "2", "ordinals": {}},
    ]
    with pytest.raises(ValueError, match="no line for verse"):
        trans_mod.build_lines(edition, verses, "test")
