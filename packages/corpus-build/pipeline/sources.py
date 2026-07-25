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
)

# The edition whose segmentation defines canonical verse identities.
SEGMENTATION_SOURCE_ID = "tanzil-uthmani"

SOURCES_BY_ID: dict[str, Source] = {s.id: s for s in SOURCES}


def text_edition_sources() -> tuple[Source, ...]:
    return tuple(s for s in SOURCES if s.role == "text-edition")
