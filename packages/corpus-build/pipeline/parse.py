"""Stage 2 — parse.

Turn the Tanzil ``sura|aya|text`` line format (the ``txt-2`` download) into
structured verse records, and the Tanzil metadata XML into surah records.

The parser is loss-free for the verse data: ``serialise(parse_text(raw))``
reproduces the verse lines of the source byte-for-byte. Verse text is never
stripped or altered here — that is the whole point of keeping ``text_uthmani``
immutable downstream.
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from dataclasses import dataclass

_VERSE_LINE = re.compile(r"^(\d+)\|(\d+)\|(.*)$")


@dataclass(frozen=True)
class VerseRecord:
    surah: int
    ayah: int
    text: str


@dataclass(frozen=True)
class SurahMeta:
    number: int
    ayas: int
    name_ar: str
    name_translit: str
    name_en: str
    revelation_place: str
    revelation_order: int


def parse_text(raw: str) -> list[VerseRecord]:
    verses: list[VerseRecord] = []
    for line in raw.split("\n"):
        match = _VERSE_LINE.match(line)
        if match is None:
            continue
        surah, ayah, text = match.groups()
        verses.append(VerseRecord(int(surah), int(ayah), text))
    return verses


def serialise(verses: list[VerseRecord]) -> str:
    return "\n".join(f"{v.surah}|{v.ayah}|{v.text}" for v in verses)


def parse_metadata(xml_text: str) -> list[SurahMeta]:
    root = ET.fromstring(xml_text)
    metas: list[SurahMeta] = []
    for sura in root.iter("sura"):
        metas.append(
            SurahMeta(
                number=int(sura.attrib["index"]),
                ayas=int(sura.attrib["ayas"]),
                name_ar=sura.attrib["name"],
                name_translit=sura.attrib["tname"],
                name_en=sura.attrib["ename"],
                revelation_place=sura.attrib["type"],
                revelation_order=int(sura.attrib["order"]),
            )
        )
    metas.sort(key=lambda m: m.number)
    return metas
