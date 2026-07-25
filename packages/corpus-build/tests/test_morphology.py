from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline import build as build_mod
from pipeline import translit
from pipeline.morphology import afold_ext


@pytest.fixture(scope="module")
def artifacts(tmp_path_factory) -> Path:
    out_root = tmp_path_factory.mktemp("out")
    return build_mod.build(out_root=out_root)


def _tokens(artifacts: Path) -> list[dict]:
    return [json.loads(x) for x in (artifacts / "tokens.jsonl").read_text(encoding="utf-8").splitlines() if x]


def _roots(artifacts: Path) -> list[dict]:
    return json.loads((artifacts / "morphology" / "roots.json").read_text(encoding="utf-8"))


def test_token_count_unchanged(artifacts: Path) -> None:
    assert len(_tokens(artifacts)) == 77881


def test_morphology_is_an_annotation_layer_only(artifacts: Path) -> None:
    # Token ids, positions and surface text are unchanged from v0.4.0 — morphology
    # adds a field, it does not resegment. Compare to v0.4.0 on disk when present.
    from pipeline.paths import OUT_DIR

    prev = OUT_DIR / "v0.4.0" / "tokens.jsonl"
    if not prev.exists():
        pytest.skip("v0.4.0 not on disk")
    old = {json.loads(x)["id"]: json.loads(x) for x in prev.read_text(encoding="utf-8").splitlines() if x}
    for t in _tokens(artifacts):
        o = old[t["id"]]
        for field in ("surah", "slot", "position", "segment_id", "text_uthmani", "is_basmala"):
            assert t[field] == o[field], (t["id"], field)
        assert "morphology" in t
        # v0.4.0 had no morphology; the only added key is morphology.
        assert set(t) - set(o) == {"morphology"}


def test_every_token_has_a_morphology_block(artifacts: Path) -> None:
    for t in _tokens(artifacts):
        m = t["morphology"]
        assert isinstance(m["pos"], str) and m["pos"]
        assert isinstance(m["segments"], list) and m["segments"]
        assert m["morphology_source"] == "leeds-qac-morphology"


def test_root_of_zakat_is_z_k_w(artifacts: Path) -> None:
    by_id = {t["id"]: t for t in _tokens(artifacts)}
    # ٱلزَّكَوٰةَ in "wa ʾātū z-zakāta" (2:43): its root is ز ك و.
    zakat = by_id["quran:tanzil-uthmani:2:43:4"]
    assert zakat["morphology"]["root"] == "ز ك و"
    assert zakat["morphology"]["root_slug"] == "z-k-w"
    assert zakat["morphology"]["lemma"] == "زَكاة"
    # The root is shared across the corpus, not a one-off tag.
    assert sum(1 for t in by_id.values() if t["morphology"]["root"] == "ز ك و") > 1


def test_no_root_is_null_never_empty_string(artifacts: Path) -> None:
    without = 0
    for t in _tokens(artifacts):
        root = t["morphology"]["root"]
        assert root is None or (isinstance(root, str) and root != "")
        if root is None:
            assert t["morphology"]["root_slug"] is None
            without += 1
    # The count of no-root tokens is a reported figure (see the manifest/report).
    manifest = json.loads((artifacts / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["morphology"]["roots"]["tokens_without_root"] == without
    assert without > 0


def test_every_token_with_a_root_has_a_lemma(artifacts: Path) -> None:
    for t in _tokens(artifacts):
        m = t["morphology"]
        if m["root"] is not None:
            assert m["lemma"], t["id"]


def test_segments_concatenate_to_the_surface_form(artifacts: Path) -> None:
    # A token's morphological surface is exactly the concatenation of its segment
    # texts, and folds to the token's Tanzil surface (the two editions differ only
    # orthographically). Both properties hold for every token.
    for t in _tokens(artifacts):
        segs = t["morphology"]["segments"]
        surface = "".join(s["text"] for s in segs)
        assert afold_ext(surface) == afold_ext(t["text_uthmani"]), t["id"]


def test_alignment_report_enumerates_every_divergence(artifacts: Path) -> None:
    report = (artifacts / "morphology" / "alignment-report.md").read_text(encoding="utf-8")
    # 100% alignment, and the four whitespace/word divergences are listed by name.
    assert "100.0000%" in report
    for loc in ("2:181:3", "8:6:4", "13:37:8", "37:130:3"):
        assert loc in report
    # The two extended-fold tokens and the one multi-root word are disclosed.
    assert "12:39:1" in report and "12:41:1" in report
    assert "20:94:2" in report


def test_manifest_records_morphology_provenance_and_licence(artifacts: Path) -> None:
    manifest = json.loads((artifacts / "manifest.json").read_text(encoding="utf-8"))
    m = manifest["morphology"]
    assert m["source_id"] == "leeds-qac-morphology"
    assert m["licence"] == "GPL-2.0-or-later"
    assert m["alignment"]["failed"] == 0
    assert m["alignment"]["unaligned_our"] == 0
    assert m["alignment"]["align_rate"] == 1.0
    # The Leeds source is recorded distinctly from the CC-BY Tanzil sources.
    sources = {s["id"]: s for s in json.loads((artifacts / "sources.json").read_text(encoding="utf-8"))}
    assert sources["leeds-qac-morphology"]["licence"] == "GPL-2.0-or-later"
    assert sources["tanzil-uthmani"]["licence"].startswith("CC-BY")


def test_leeds_data_directory_carries_its_own_licence(artifacts: Path) -> None:
    licence = (artifacts / "morphology" / "LICENSE").read_text(encoding="utf-8")
    assert "GNU GENERAL PUBLIC LICENSE" in licence
    attribution = (artifacts / "morphology" / "ATTRIBUTION.md").read_text(encoding="utf-8")
    for needle in ("Kais Dukes", "University of Leeds", "corpus.quran.com", "GPL"):
        assert needle in attribution


def test_roots_artifact_is_consistent(artifacts: Path) -> None:
    roots = _roots(artifacts)
    tokens = {t["id"]: t for t in _tokens(artifacts)}
    assert len(roots) == 1651
    total = 0
    for r in roots:
        assert translit.from_slug(r["root_slug"]) == r["root"]
        assert r["occurrences"] == len(r["token_ids"])
        total += r["occurrences"]
        # Every listed token really carries this root.
        for tid in r["token_ids"]:
            assert tokens[tid]["morphology"]["root"] == r["root"]
    # roots are sorted most-frequent-first; the head is the root of "Allah".
    assert roots[0]["root"] == "أ ل ه"
    assert total == sum(1 for t in tokens.values() if t["morphology"]["root"] is not None)


def test_roots_json_slugs_round_trip(artifacts: Path) -> None:
    for r in _roots(artifacts):
        assert translit.to_slug(r["root"]) == r["root_slug"]
        assert translit.from_slug(r["root_slug"]) == r["root"]
