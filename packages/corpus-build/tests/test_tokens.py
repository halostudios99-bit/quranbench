from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline import build as build_mod
from pipeline.tokens import is_mark_run, segment_verse


@pytest.fixture(scope="module")
def artifacts(tmp_path_factory) -> Path:
    return build_mod.build(out_root=tmp_path_factory.mktemp("out"))


@pytest.fixture(scope="module")
def tokens(artifacts: Path) -> list[dict]:
    return [json.loads(line) for line in (artifacts / "tokens.jsonl").read_text("utf-8").splitlines()]


@pytest.fixture(scope="module")
def verses(artifacts: Path) -> dict[tuple[int, str], dict]:
    rows = [json.loads(line) for line in (artifacts / "verses.jsonl").read_text("utf-8").splitlines()]
    return {(v["surah"], v["slot"]): v for v in rows}


def _by_verse(tokens: list[dict]) -> dict[tuple[int, str], list[dict]]:
    out: dict[tuple[int, str], list[dict]] = {}
    for t in tokens:
        out.setdefault((t["surah"], t["slot"]), []).append(t)
    for v in out.values():
        v.sort(key=lambda t: t["position"])
    return out


# --- unit tests on the segmenter -------------------------------------------------

def test_mark_run_detection() -> None:
    assert is_mark_run("ۚ")  # standalone small high jeem (waqf)
    assert is_mark_run("۞")  # rub-el-hizb
    assert is_mark_run("۩")  # sajda
    assert not is_mark_run("")
    assert not is_mark_run("مِن")  # a real word


def test_standalone_marks_attach_to_preceding_token() -> None:
    seg = segment_verse(1, "1", "من ۚ هو")
    assert [t.text for t in seg.tokens] == ["من", "هو"]
    assert seg.tokens[0].following_marks == ["ۚ"]
    assert seg.marks_excluded == 1


def test_leading_mark_becomes_verse_leading_marks() -> None:
    seg = segment_verse(2, "26", "ۚ من")
    assert seg.leading_marks == ["ۚ"]
    assert [t.text for t in seg.tokens] == ["من"]


def test_char_offsets_index_into_verse_text() -> None:
    text = "من هو"
    seg = segment_verse(1, "1", text)
    for t in seg.tokens:
        assert text[t.char_start : t.char_end] == t.text


# --- integration tests on the built corpus --------------------------------------

def test_token_count_is_reported(tokens: list[dict]) -> None:
    # No authoritative count exists until segmentation is fixed; just report it.
    print(f"\nTOTAL TOKENS: {len(tokens)}")
    assert len(tokens) > 70000


def test_every_token_id_is_unique(tokens: list[dict]) -> None:
    ids = [t["id"] for t in tokens]
    assert len(ids) == len(set(ids))


def test_positions_contiguous_from_one(tokens: list[dict]) -> None:
    for (surah, ayah), group in _by_verse(tokens).items():
        positions = [t["position"] for t in group]
        assert positions == list(range(1, len(group) + 1)), (surah, ayah)


def test_no_token_is_only_marks(tokens: list[dict]) -> None:
    for t in tokens:
        assert not is_mark_run(t["text_uthmani"]), t["id"]


def test_roundtrip_reproduces_verse_text(tokens: list[dict], verses: dict) -> None:
    by_verse = _by_verse(tokens)
    for key, verse in verses.items():
        pieces = list(verse["leading_marks"])
        for t in by_verse[key]:
            pieces.append(t["text_uthmani"])
            pieces.extend(t["following_marks"])
        assert " ".join(pieces) == verse["text_uthmani"], key


# Diacritic-free normalised forms are safe to compare against literally; the fully
# vowelled Uthmani forms are not, because a text editor reorders adjacent combining
# marks. So the content assertions below compare against text_normalised.

def _first_norm(by_verse, s, slot) -> str:
    return by_verse[(s, slot)][0]["text_normalised"]


def test_basmala_separation_reflected_in_tokens(tokens: list[dict]) -> None:
    bv = _by_verse(tokens)
    assert _first_norm(bv, 2, "1") == "الم"  # الٓمٓ — not the basmala
    assert _first_norm(bv, 1, "1") == "بسم"  # 1:1 is the basmala
    assert _first_norm(bv, 9, "1") == "براءه"  # بَرَآءَةٌ — surah 9's own word


def test_separated_basmala_tokens_use_the_named_slot(tokens: list[dict]) -> None:
    bv = _by_verse(tokens)
    basmala = bv[(2, "basmala")]
    assert [t["text_normalised"] for t in basmala] == [
        "بسم",
        "الله",
        "الرحمن",
        "الرحيم",
    ]
    assert all(t["is_basmala"] for t in basmala)
    assert all(t["id"].startswith("quran:tanzil-uthmani:2:basmala:") for t in basmala)
    assert all(t["segment_id"] == "quran:tanzil-uthmani:2:basmala" for t in basmala)
    # Surah 1's basmala tokens are ordinary verse tokens, not flagged separated,
    # and surah 9 has no basmala slot at all.
    assert all(not t["is_basmala"] for t in bv[(1, "1")])
    assert (9, "basmala") not in bv


def test_27_30_keeps_basmala_in_its_token_stream(tokens: list[dict]) -> None:
    bv = _by_verse(tokens)
    words = [t["text_normalised"] for t in bv[(27, "30")]]
    # The basmala appears mid-verse as the verse's own content — do not strip it.
    assert "بسم" in words
    assert "الله" in words
    assert "الرحمن" in words


def test_2_43_has_seven_tokens_and_zakat_at_position_four(tokens: list[dict]) -> None:
    bv = _by_verse(tokens)
    group = bv[(2, "43")]
    assert len(group) == 7
    assert group[3]["position"] == 4
    assert group[3]["text_normalised"] == "الزكوه"  # ٱلزَّكَوٰةَ
