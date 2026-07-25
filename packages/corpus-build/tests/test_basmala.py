from __future__ import annotations

import pytest

from pipeline.basmala import (
    CANONICAL_BASMALA,
    BasmalaError,
    split_simple,
    split_uthmani,
)
from pipeline.parse import parse_text


def _verse_one(raw: str) -> dict[int, str]:
    return {v.surah: v.text for v in parse_text(raw) if v.ayah == 1}


def test_fatiha_basmala_is_verse_one_and_not_separated(uthmani_raw: str) -> None:
    v1 = _verse_one(uthmani_raw)
    split = split_uthmani(1, v1[1])
    assert split.separated is False
    assert split.basmala == CANONICAL_BASMALA
    assert split.verse_one == v1[1]  # 1:1 is unchanged


def test_baqara_verse_one_loses_the_basmala(uthmani_raw: str) -> None:
    v1 = _verse_one(uthmani_raw)
    split = split_uthmani(2, v1[2])
    assert split.separated is True
    assert split.basmala == CANONICAL_BASMALA
    # Only the verse's own content remains, and it is not the basmala.
    assert not split.verse_one.startswith("بِس")  # بِس
    # Reconstructing basmala + remainder reproduces the original verse 1 exactly.
    assert f"{split.basmala} {split.verse_one}" == v1[2]


def test_surah_nine_has_no_basmala(uthmani_raw: str) -> None:
    v1 = _verse_one(uthmani_raw)
    split = split_uthmani(9, v1[9])
    assert split.basmala is None  # absent, not empty string
    assert split.separated is False
    assert split.verse_one == v1[9]


def test_shadda_variant_surahs_are_separated(uthmani_raw: str) -> None:
    v1 = _verse_one(uthmani_raw)
    for surah in (95, 97):
        split = split_uthmani(surah, v1[surah])
        assert split.separated is True
        # The variant basmala differs from the standard by a shadda on the ba.
        assert split.basmala != CANONICAL_BASMALA


def test_exactly_112_surahs_are_separated(uthmani_raw: str) -> None:
    v1 = _verse_one(uthmani_raw)
    separated = sum(1 for s in range(1, 115) if split_uthmani(s, v1[s]).separated)
    assert separated == 112


def test_both_editions_separate_the_same_112(uthmani_raw: str, simple_raw: str) -> None:
    vu, vs = _verse_one(uthmani_raw), _verse_one(simple_raw)
    su = {s for s in range(1, 115) if split_uthmani(s, vu[s]).separated}
    ss = {s for s in range(1, 115) if split_simple(s, vs[s]).separated}
    assert su == ss
    assert 9 not in su and 1 not in su


def test_split_fails_loudly_on_unexpected_prefix() -> None:
    # Surah 9 must not carry a basmala; if one appears, the build must fail.
    with pytest.raises(BasmalaError):
        split_uthmani(9, CANONICAL_BASMALA + " كٰلمة")
    # A non-surah-1 surah whose verse 1 lacks the basmala must fail.
    with pytest.raises(BasmalaError):
        split_uthmani(2, "الم")  # bare "الم", no basmala prefix
