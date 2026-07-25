from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from pipeline import build as build_mod
from pipeline import lexicon


# ── unit: decoding + folding ─────────────────────────────────────────────────
def test_decode_buckwalter_letters_and_hamza() -> None:
    assert lexicon.decode_buckwalter("zbd") == "زبد"
    assert lexicon.decode_buckwalter("ktb") == "كتب"
    # A^ is hamza-on-alef; ~ is shadda; a/i/u are short vowels.
    assert lexicon.decode_buckwalter("zaA^ara") == "زَأَرَ"


def test_fold_collapses_hamza_and_weak_seatings() -> None:
    # All hamza/alef seats fold to one class; ى→ي, ة→ت.
    assert lexicon.fold_radicals("أ ل ه") == lexicon.fold_radicals("ا ل ه")
    assert lexicon.fold_radicals("ز ك و") == "زكو"
    assert lexicon.fold_key("zkw") == "زكو"


# ── integration: the built corpus ────────────────────────────────────────────
@pytest.fixture(scope="module")
def artifacts(tmp_path_factory) -> Path:
    out_root = tmp_path_factory.mktemp("out")
    return build_mod.build(out_root=out_root)


def _lane(artifacts: Path) -> list[dict]:
    return json.loads((artifacts / "lexicon" / "lane.json").read_text(encoding="utf-8"))


def _manifest(artifacts: Path) -> dict:
    return json.loads((artifacts / "manifest.json").read_text(encoding="utf-8"))


def test_no_fold_collisions_so_matches_cannot_be_wrong(artifacts: Path) -> None:
    # The whole approach's safety rests on this: no two corpus roots share a fold.
    assert _manifest(artifacts)["lexicon"]["coverage"]["fold_collisions"] == 0


def test_coverage_is_reported_and_substantial(artifacts: Path) -> None:
    cov = _manifest(artifacts)["lexicon"]["coverage"]
    assert cov["corpus_roots"] == 1651
    assert cov["roots_with_entry"] == len(_lane(artifacts))
    # Honest coverage: well above the ~81% floor, short of 100% (Lane is unfinished).
    assert 0.90 <= cov["coverage_fraction"] < 1.0
    assert cov["roots_with_entry"] + cov["roots_without_entry"] == 1651


def test_a_root_with_an_entry_renders_arabic_not_buckwalter(artifacts: Path) -> None:
    by_slug = {r["root_slug"]: r for r in _lane(artifacts)}
    entry = by_slug["z-k-w"]
    assert entry["headword_ar"] == "زكو"
    assert entry["licence"] == "CC-BY-SA-3.0"
    # The decoded article contains real Arabic script…
    assert re.search(r"[؀-ۿ]", entry["text"])
    # …and no leftover <foreign> Buckwalter markup.
    assert "<foreign" not in entry["text"]


def test_a_root_absent_from_lane_has_no_entry(artifacts: Path) -> None:
    # دبر is genuinely absent from this Perseus digitization — it must not be
    # fabricated or mis-matched to another article.
    by_slug = {r["root_slug"]: r for r in _lane(artifacts)}
    assert "d-b-r" not in by_slug


def test_lexicon_does_not_change_root_ids(artifacts: Path) -> None:
    from pipeline.paths import OUT_DIR

    prev = OUT_DIR / "v0.7.0" / "morphology" / "roots.json"
    if not prev.exists():
        pytest.skip("v0.7.0 not on disk")
    old = {r["root_slug"] for r in json.loads(prev.read_text(encoding="utf-8"))}
    new = {
        r["root_slug"]
        for r in json.loads(
            (artifacts / "morphology" / "roots.json").read_text(encoding="utf-8")
        )
    }
    assert old == new
