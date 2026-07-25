"""The upstream sources ingested by the pipeline.

One entry per ``Source`` in the entity model (docs/extensibility.md): a text
tradition or edition with a licence, publisher, year and checksum. This module
is the single source of truth shared by ``fetch`` (what to download and verify)
and ``build`` (what to emit as ``sources.json``).

``year`` is deliberately ``None`` for the two text editions: Tanzil stamps a
*version* (1.1) in the file's copyright block but not a release year, so we
record the version in ``edition`` and refuse to fabricate a year.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    publisher: str
    edition: str
    year: int | None
    url: str
    licence: str
    filename: str
    role: str  # "text-edition" | "metadata"


SOURCES: tuple[Source, ...] = (
    Source(
        id="tanzil-uthmani",
        name="Tanzil Quran Text (Uthmani)",
        publisher="Tanzil Project",
        edition="Uthmani 1.1",
        year=None,
        # marks=true keeps the standalone waqf/pause marks the token layer detects
        # and excludes; sajdah/rub keep the sajda (۩) and rub-el-hizb (۞) markers so
        # their exclusion is exercised against real data rather than assumed absent.
        url="https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&marks=true&sajdah=true&rub=true&agree=true",
        licence="CC-BY-3.0",
        filename="tanzil-uthmani.txt",
        role="text-edition",
    ),
    Source(
        id="tanzil-simple",
        name="Tanzil Quran Text (Simple)",
        publisher="Tanzil Project",
        edition="Simple 1.1",
        year=None,
        url="https://tanzil.net/pub/download/index.php?quranType=simple&outType=txt-2&agree=true",
        licence="CC-BY-3.0",
        filename="tanzil-simple.txt",
        role="text-edition",
    ),
    Source(
        id="tanzil-metadata",
        name="Tanzil Quran Metadata",
        publisher="Tanzil Project",
        edition="1.0",
        year=2009,
        url="https://tanzil.net/res/text/metadata/quran-data.xml",
        licence="CC-BY-3.0",
        filename="quran-metadata.xml",
        role="metadata",
    ),
    # The Quranic Arabic Corpus morphology (Leeds, Kais Dukes), GPL. Ingested via
    # the mustafa0x fork, which converts the Buckwalter transliteration of QAC v0.4
    # to Arabic script and applies documented corrections (see morphology/ATTRIBUTION.md).
    # Copyleft propagates: any artifact carrying this data is GPL-2.0-or-later. Pinned
    # to an immutable commit so the download is reproducible and checksum-stable.
    Source(
        id="leeds-qac-morphology",
        name="Quranic Arabic Corpus — Morphology (mustafa0x fork of Leeds QAC v0.4)",
        publisher="Kais Dukes / University of Leeds (fork: mustafa0x)",
        edition="QAC 0.4 (mustafa0x fork, commit 8f38b39)",
        year=2011,
        url=(
            "https://raw.githubusercontent.com/mustafa0x/quran-morphology/"
            "8f38b39016824284f9ed16ae15069ff9102c4acf/quran-morphology.txt"
        ),
        licence="GPL-2.0-or-later",
        filename="quran-morphology.txt",
        role="morphology",
    ),
    # The Leeds QAC's terse per-word English gloss and per-word transliteration,
    # taken from the corpus author's own backend (Kais Dukes, kaisdukes/
    # quranic-corpus-api), pinned to an immutable commit. Both files are strictly
    # positional — one line per word in canonical mushaf order — matching the
    # 77,429 distinct word-locations of the morphology file exactly, which is how
    # they align onto our token ids (see pipeline/glosses.py). The QAC content is
    # GPL (corpus.quran.com/download states "License: GNU General Public License");
    # the caveat that this specific repo carries no LICENSE file of its own is
    # recorded honestly in morphology/GLOSS-ATTRIBUTION.md. Copyleft propagates:
    # any artifact carrying this data is GPL-2.0-or-later, as tokens.jsonl already is.
    Source(
        id="qac-word-gloss",
        name="Quranic Arabic Corpus — word-by-word English gloss (Kais Dukes)",
        publisher="Kais Dukes / University of Leeds",
        edition="QAC (quranic-corpus-api, commit 17a9062)",
        year=2011,
        url=(
            "https://raw.githubusercontent.com/kaisdukes/quranic-corpus-api/"
            "17a9062416eccc332111ef3e84f74072d709e187/"
            "src/main/resources/data/translation/word-by-word.txt"
        ),
        licence="GPL-2.0-or-later",
        filename="qac-word-gloss.txt",
        role="word-gloss",
    ),
    Source(
        id="qac-word-transliteration",
        name="Quranic Arabic Corpus — word-by-word transliteration (Kais Dukes)",
        publisher="Kais Dukes / University of Leeds",
        edition="QAC (quranic-corpus-api, commit 17a9062)",
        year=2011,
        url=(
            "https://raw.githubusercontent.com/kaisdukes/quranic-corpus-api/"
            "17a9062416eccc332111ef3e84f74072d709e187/regression/phonetic.txt"
        ),
        licence="GPL-2.0-or-later",
        filename="qac-word-transliteration.txt",
        role="word-transliteration",
    ),
)

# The edition whose segmentation defines canonical verse identities.
SEGMENTATION_SOURCE_ID = "tanzil-uthmani"

# The source id whose morphological annotation is layered onto tokens.
MORPHOLOGY_SOURCE_ID = "leeds-qac-morphology"

# The QAC word-gloss and word-transliteration annotation sources.
GLOSS_SOURCE_ID = "qac-word-gloss"
TRANSLITERATION_SOURCE_ID = "qac-word-transliteration"

SOURCES_BY_ID: dict[str, Source] = {s.id: s for s in SOURCES}


def text_edition_sources() -> tuple[Source, ...]:
    return tuple(s for s in SOURCES if s.role == "text-edition")
