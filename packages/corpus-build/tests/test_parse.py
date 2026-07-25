from __future__ import annotations

from pipeline.parse import parse_metadata, parse_text, serialise


def test_counts_verses_and_surahs(uthmani_raw: str) -> None:
    verses = parse_text(uthmani_raw)
    assert len(verses) == 6236
    assert len({v.surah for v in verses}) == 114
    assert min(v.surah for v in verses) == 1
    assert max(v.surah for v in verses) == 114


def test_known_surah_lengths(uthmani_raw: str) -> None:
    verses = parse_text(uthmani_raw)
    per_surah: dict[int, int] = {}
    for v in verses:
        per_surah[v.surah] = per_surah.get(v.surah, 0) + 1
    assert per_surah[1] == 7
    assert per_surah[2] == 286
    assert per_surah[114] == 6


def test_ayah_numbering_is_contiguous_from_one(uthmani_raw: str) -> None:
    verses = parse_text(uthmani_raw)
    per_surah: dict[int, list[int]] = {}
    for v in verses:
        per_surah.setdefault(v.surah, []).append(v.ayah)
    for surah, ayat in per_surah.items():
        assert ayat == list(range(1, len(ayat) + 1)), surah


def test_both_editions_parse_to_same_verse_set(
    uthmani_raw: str, simple_raw: str
) -> None:
    u = {(v.surah, v.ayah) for v in parse_text(uthmani_raw)}
    s = {(v.surah, v.ayah) for v in parse_text(simple_raw)}
    assert u == s


def test_roundtrip_is_byte_for_byte(uthmani_raw: str, simple_raw: str) -> None:
    # serialise(parse(raw)) reproduces the verse lines of the source exactly.
    # The Tanzil copyright trailer is not verse data and is preserved separately.
    for raw in (uthmani_raw, simple_raw):
        verse_lines = "\n".join(
            line for line in raw.split("\n") if _is_verse_line(line)
        )
        assert serialise(parse_text(raw)) == verse_lines


def test_metadata_covers_114_surahs(metadata_raw: str) -> None:
    metas = parse_metadata(metadata_raw)
    assert len(metas) == 114
    assert [m.number for m in metas] == list(range(1, 115))
    first = metas[0]
    assert first.name_translit == "Al-Faatiha"
    assert first.ayas == 7


def _is_verse_line(line: str) -> bool:
    head = line.split("|", 2)
    return len(head) == 3 and head[0].isdigit() and head[1].isdigit()
