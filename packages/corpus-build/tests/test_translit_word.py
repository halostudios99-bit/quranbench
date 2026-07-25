from __future__ import annotations

import pytest

from pipeline import translit_word as tw

# The 30 reversible letters: 28 consonants, bare hamza, and long alef.
_REVERSIBLE = "ءابتثجحخدذرزسشصضطظعغفقكلمنهوي"


def test_letter_map_is_a_bijection() -> None:
    codes = list(tw.LETTER_TO_LATIN.values())
    assert len(codes) == len(set(codes)), "duplicate transliteration codes"
    assert set(tw.LATIN_TO_LETTER) == set(codes)


def test_every_letter_round_trips() -> None:
    for letter in _REVERSIBLE:
        assert tw.round_trips(letter), letter


def test_consonant_skeleton_round_trips() -> None:
    # A whole skeleton, spaces ignored, recovers exactly.
    for skeleton in ("زكو", "ك ت ب", "سمو", "رحم", "علم"):
        assert tw.round_trips(skeleton), skeleton


def test_documented_expected_values() -> None:
    # Hand-written expected values for the computed DIN-31635 fallback on clean,
    # fully-voweled words. (The shipped per-word transliteration comes from the QAC
    # phonetic file; this asserts the fallback scheme itself is correct.)
    cases = {
        "بِسْمِ": "bismi",
        "كَتَبَ": "kataba",
        "قُلْ": "qul",
        "نَصْر": "naṣr",
        "عِلْم": "ʿilm",
        "شَمْس": "šams",
    }
    for arabic, expected in cases.items():
        assert tw.transliterate(arabic) == expected, arabic


def test_shadda_doubles_the_preceding_consonant() -> None:
    assert tw.transliterate("رَبَّ") == "rabba"


def test_recitation_marks_are_dropped_not_passed_through() -> None:
    # A small high seen (U+06DC) is a recitation mark, not a letter: it vanishes.
    assert tw.transliterate("نۖ") == "n"


def test_unknown_base_letter_is_visible_not_swallowed() -> None:
    # A Latin letter is not Arabic; it passes through so a gap is obvious.
    assert "x" in tw.transliterate("x")
