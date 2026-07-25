"""Stage — word gloss + transliteration (annotation layer).

Two positional annotation files from the Quranic Arabic Corpus (Kais Dukes'
``quranic-corpus-api``) give, per word, a terse English gloss and a Latin
transliteration:

    qac-word-gloss.txt            "In (the) name", "(of) Allah,", ...
    qac-word-transliteration.txt  "bis'mi", "l-lahi", ...

Neither file carries a ``surah:verse:word`` key: each is strictly one line per
word in canonical mushaf order. The morphology file *is* keyed by location, and
its 77,429 distinct word-locations line up 1:1 with these files in the same
order. So we recover the location for line *i* from the morphology file's *i*-th
distinct word, giving a ``(surah, verse, word) -> (gloss, transliteration)`` map
that the existing morphology aligner (``pipeline.morphology``) then carries onto
token ids — we reuse that proven word→token alignment rather than writing a
second aligner.

Like the morphology, this is an **annotation**: token ids, positions and surface
text are never touched. The gloss/transliteration are the same GPL Quranic Arabic
Corpus content as the morphology (copyleft propagates; see
morphology/GLOSS-ATTRIBUTION.md), so a token that already carries the GPL
``morphology`` block gains these fields within it.
"""

from __future__ import annotations

from dataclasses import dataclass


class GlossAlignmentError(RuntimeError):
    """The positional files do not line up with the morphology word set. A count
    mismatch means the join would be silently wrong, so we refuse rather than ship
    misattributed glosses."""


@dataclass(frozen=True)
class WordAnnotation:
    gloss: str
    transliteration: str


def distinct_word_locations(morphology_text: str) -> list[tuple[int, int, int]]:
    """The ``(surah, verse, word)`` of every distinct Leeds word, in file order.

    The morphology file is one line per *segment*; collapsing to distinct word
    locations in first-appearance order reproduces canonical mushaf word order,
    which is the order the positional gloss/transliteration files use.
    """
    seen: set[tuple[int, int, int]] = set()
    order: list[tuple[int, int, int]] = []
    for line in morphology_text.splitlines():
        if not line.strip():
            continue
        loc = line.split("\t")[0]
        s, v, w, _seg = (int(x) for x in loc.split(":"))
        key = (s, v, w)
        if key not in seen:
            seen.add(key)
            order.append(key)
    return order


def _lines(text: str) -> list[str]:
    lines = text.split("\n")
    if lines and lines[-1] == "":
        lines.pop()
    return lines


def load_word_annotations(
    morphology_text: str,
    gloss_text: str,
    transliteration_text: str,
) -> dict[tuple[int, int, int], WordAnnotation]:
    """Build the ``(surah, verse, word) -> WordAnnotation`` map, asserting the
    three sources agree on the word count before trusting the positional join."""
    locations = distinct_word_locations(morphology_text)
    glosses = _lines(gloss_text)
    translits = _lines(transliteration_text)

    if not (len(locations) == len(glosses) == len(translits)):
        raise GlossAlignmentError(
            "word-count mismatch between morphology and the positional annotation "
            f"files: morphology words={len(locations)}, glosses={len(glosses)}, "
            f"transliterations={len(translits)}. The positional join requires all "
            "three to agree — refusing to align."
        )

    out: dict[tuple[int, int, int], WordAnnotation] = {}
    for loc, gloss, translit in zip(locations, glosses, translits):
        out[loc] = WordAnnotation(gloss=gloss, transliteration=translit)
    return out
