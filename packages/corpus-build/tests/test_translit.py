from __future__ import annotations

from pipeline import translit


def test_documented_example_round_trips_both_ways() -> None:
    # The example baked into docs/architecture.md: root:ز ك و <-> /root/z-k-w.
    assert translit.to_slug("ز ك و") == "z-k-w"
    assert translit.to_slug("زكو") == "z-k-w"  # unspaced input, same slug
    assert translit.from_slug("z-k-w") == "ز ك و"


def test_map_is_a_bijection() -> None:
    codes = list(translit.LETTER_TO_CODE.values())
    assert len(codes) == len(set(codes)), "duplicate slug codes"
    assert set(translit.CODE_TO_LETTER) == set(codes)


def test_every_letter_round_trips() -> None:
    for letter in translit.LETTER_TO_CODE:
        assert translit.from_slug(translit.to_slug(letter)) == letter


def test_slugs_are_url_safe() -> None:
    for code in translit.LETTER_TO_CODE.values():
        assert code.isascii() and code.isalnum() and code.islower()


def test_unknown_inputs_raise() -> None:
    import pytest

    with pytest.raises(translit.TransliterationError):
        translit.to_slug("x")  # not an Arabic root letter
    with pytest.raises(translit.TransliterationError):
        translit.from_slug("zz9")  # not a code
