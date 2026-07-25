from __future__ import annotations

from pipeline.numbering import (
    BASMALA_KIND,
    KUFAN,
    VERSE_KIND,
    NumberingScheme,
    Segment,
    assign_ordinals,
)


def _surah(surah: int, *, basmala: bool, verses: int) -> list[Segment]:
    segs: list[Segment] = []
    if basmala:
        segs.append(Segment(surah, "basmala", BASMALA_KIND))
    for n in range(1, verses + 1):
        segs.append(Segment(surah, str(n), VERSE_KIND))
    return segs


def test_kufan_numbers_verses_and_skips_a_separated_basmala() -> None:
    # A normal surah: separated basmala at the head, then three verses.
    segments = {2: _surah(2, basmala=True, verses=3)}
    ordinals = assign_ordinals(KUFAN, segments)
    assert ordinals == {(2, "1"): 1, (2, "2"): 2, (2, "3"): 3}
    # The named basmala slot receives no ordinal — that absence is its position.
    assert (2, "basmala") not in ordinals


def test_kufan_counts_al_fatiha_basmala_as_verse_one() -> None:
    # Al-Fatiha's basmala is not separated; it is verse 1 and is counted.
    segments = {1: _surah(1, basmala=False, verses=7)}
    ordinals = assign_ordinals(KUFAN, segments)
    assert ordinals[(1, "1")] == 1
    assert len(ordinals) == 7


def test_ordinals_reset_per_surah() -> None:
    segments = {
        2: _surah(2, basmala=True, verses=2),
        3: _surah(3, basmala=True, verses=2),
    }
    ordinals = assign_ordinals(KUFAN, segments)
    assert ordinals[(2, "1")] == 1
    assert ordinals[(3, "1")] == 1  # restarts, not continued from surah 2


def test_a_scheme_that_counted_the_basmala_would_differ() -> None:
    # Demonstrates the mechanism is data-driven: flipping the 'basmala' rule
    # renumbers everything. We do not ship such a scheme, but the applier supports
    # it, which is what makes numbering a parameter rather than a hardcoded fact.
    counts_basmala = NumberingScheme(
        id="hypothetical",
        name="hypothetical",
        full_name="hypothetical",
        source={"citation": "test only"},
        is_default=False,
        order="textual",
        reset_per="surah",
        start_at=1,
        counts={VERSE_KIND: True, BASMALA_KIND: True},
        note="test",
    )
    segments = {2: _surah(2, basmala=True, verses=2)}
    ordinals = assign_ordinals(counts_basmala, segments)
    assert ordinals[(2, "basmala")] == 1
    assert ordinals[(2, "1")] == 2  # the basmala pushed verse 1 to ordinal 2
