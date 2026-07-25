from __future__ import annotations

import pytest

from pipeline.normalise import (
    derive_text_fields,
    derive_token_fields,
    normalise,
    strip_tashkeel,
    to_simple,
)
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


def _has_harakat(text: str) -> bool:
    return any(0x064B <= ord(c) <= 0x0652 for c in text)


def test_to_simple_keeps_harakat_but_drops_uthmani_annotation(uthmani_raw: str) -> None:
    for v in parse_text(uthmani_raw):
        simple = to_simple(v.text)
        # Alef wasla is unified to bare alef.
        assert "ٱ" not in simple
        # No recitation/pause annotation signs remain.
        assert not any(0x06D6 <= ord(c) <= 0x06ED for c in simple)
        assert not any(0x0610 <= ord(c) <= 0x061A for c in simple)
    # Unlike no-tashkeel, the simple form retains vowelling.
    v11 = _verse(uthmani_raw, 1, 1)
    assert _has_harakat(to_simple(v11))
    assert not _has_harakat(strip_tashkeel(v11))


def test_derive_token_fields_are_all_present() -> None:
    fields = derive_token_fields(_verse(open_uthmani(), 1, 2))
    assert set(fields) == {
        "text_uthmani",
        "text_simple",
        "text_no_tashkeel",
        "text_normalised",
    }


def open_uthmani() -> str:
    from pipeline.paths import SOURCES_DIR

    return (SOURCES_DIR / "tanzil-uthmani.txt").read_text(encoding="utf-8")


def test_stripping_and_normalising_are_deterministic(uthmani_raw: str) -> None:
    for v in parse_text(uthmani_raw):
        assert strip_tashkeel(v.text) == strip_tashkeel(v.text)
        assert normalise(v.text) == normalise(v.text)
