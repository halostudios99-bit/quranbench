from __future__ import annotations

import pytest

from pipeline.normalise import derive_text_fields, normalise, strip_tashkeel
from pipeline.parse import parse_text


def _verse(raw: str, surah: int, ayah: int) -> str:
    for v in parse_text(raw):
        if v.surah == surah and v.ayah == ayah:
            return v.text
    raise AssertionError(f"verse {surah}:{ayah} not found")


# Expected stripped/normalised strings below are written BY HAND (1:1 verified
# codepoint-by-codepoint against the source dump), never produced by the
# functions under test. They are applied to the *real source verse* so the test
# exercises the true input, not a re-typed copy of it. Once tashkeel is removed
# no combining marks remain, so these literals are free of mark-ordering quirks.

# 1:1  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
NO_TASHKEEL_1_1 = "بسم ٱلله ٱلرحمن ٱلرحيم"
NORMALISED_1_1 = "بسم الله الرحمن الرحيم"

# 112:1  adds قُلْ هُوَ ٱللَّهُ أَحَدٌ — exercises alef-hamza (أ -> ا).
NO_TASHKEEL_112_1 = "بسم ٱلله ٱلرحمن ٱلرحيم قل هو ٱلله أحد"
NORMALISED_112_1 = "بسم الله الرحمن الرحيم قل هو الله احد"


def test_strip_tashkeel_known_verses(uthmani_raw: str) -> None:
    assert strip_tashkeel(_verse(uthmani_raw, 1, 1)) == NO_TASHKEEL_1_1
    assert strip_tashkeel(_verse(uthmani_raw, 112, 1)) == NO_TASHKEEL_112_1


def test_normalise_known_verses(uthmani_raw: str) -> None:
    assert normalise(_verse(uthmani_raw, 1, 1)) == NORMALISED_1_1
    assert normalise(_verse(uthmani_raw, 112, 1)) == NORMALISED_112_1


@pytest.mark.parametrize("fn", [strip_tashkeel, normalise])
def test_idempotent_on_every_verse(fn, uthmani_raw: str) -> None:
    for v in parse_text(uthmani_raw):
        once = fn(v.text)
        assert fn(once) == once


def test_normalise_never_alters_text_uthmani(uthmani_raw: str, simple_raw: str) -> None:
    simple = {(v.surah, v.ayah): v.text for v in parse_text(simple_raw)}
    for v in parse_text(uthmani_raw):
        fields = derive_text_fields(v.text, simple[(v.surah, v.ayah)])
        assert fields["text_uthmani"] == v.text
        assert fields["text_simple"] == simple[(v.surah, v.ayah)]


def test_stripping_and_normalising_are_deterministic(uthmani_raw: str) -> None:
    for v in parse_text(uthmani_raw):
        assert strip_tashkeel(v.text) == strip_tashkeel(v.text)
        assert normalise(v.text) == normalise(v.text)
