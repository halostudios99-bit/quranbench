"""Regression fixtures for the rendering engine.

These exist because the grammar layer was broken twice in one session and both
times it was caught by reading output rather than by a test — after it had
already produced `and and`, `favoured you`, `upon them them`, `those whoms` and,
on a later pass, `Merciful the All-Merciful` with articles silently dropped.

Al-Fatiha is the fixture: every word in it is decided, it exercises the definite
article, attached object pronouns, a perfect verb with a subject suffix, a
genitive construct, prefixed prepositions and a plural. If a change to
grammar.py or the decision table breaks any of those, this fails immediately
instead of quietly corrupting several thousand verses.

Update the expected strings ONLY when the change is intended, and say why in the
commit message.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline.decisions import RENDERABLE, load_table, resolve
from pipeline.grammar import compose

ARTIFACTS = Path(__file__).resolve().parents[1] / "out"


def _latest() -> str:
    return sorted(p.name[1:] for p in ARTIFACTS.iterdir() if p.name.startswith("v"))[-1]


@pytest.fixture(scope="module")
def verses() -> dict[str, list[dict]]:
    tokens = [
        json.loads(line)
        for line in (ARTIFACTS / f"v{_latest()}" / "tokens.jsonl").open(encoding="utf-8")
    ]
    out: dict[str, list[dict]] = {}
    for t in tokens:
        if t["surah"] == 1:
            out.setdefault(t["slot"], []).append(t)
    for v in out.values():
        v.sort(key=lambda t: t["position"])
    return out


def render(tokens: list[dict], table: dict) -> str:
    words = []
    for i, t in enumerate(tokens):
        row = resolve(t, table)
        assert row, f"undecided token in a fixture verse: {t['text_no_tashkeel']}"
        words.append(compose(t, row["english"], tokens[i - 1] if i else None))
    return " ".join(words)


EXPECTED = {
    "1": "by name Allah the All-Merciful the Merciful",
    "2": "the praise for Allah Sustainer of the beings",
    "3": "the All-Merciful the Merciful",
    "4": "owner of Day of the accountability",
    "5": "You alone We serve and You alone We ask help",
    "6": "guide us the way the straight",
    "7": (
        "way those whom you favoured upon them other than the anger "
        "upon them and not those astray"
    ),
}


@pytest.mark.parametrize("slot", sorted(EXPECTED))
def test_al_fatiha_renders_exactly(slot: str, verses) -> None:
    assert render(verses[slot], load_table()) == EXPECTED[slot]


def test_no_doubled_words() -> None:
    """`and and`, `upon them them` — the shape of every bug so far was a word
    emitted by both the decision table and the grammar layer."""
    table = load_table()
    for text in EXPECTED.values():
        parts = text.split()
        doubled = [a for a, b in zip(parts, parts[1:]) if a == b]
        assert not doubled, f"doubled word in {text!r}: {doubled}"


def test_table_rows_are_well_formed() -> None:
    table = load_table()
    for key, row in table.items():
        if not row.get("english"):
            continue
        assert row.get("grade"), f"{key} has an English word but no grade"
        assert row["grade"] in RENDERABLE + ("undetermined",), f"{key}: bad grade"
        # Rule 20: an undetermined key must not carry a rendering.
        if row["grade"] == "undetermined":
            assert not row["english"], f"{key} is undetermined but has English"


def test_undetermined_keys_are_recorded_not_guessed() -> None:
    """The five hapaxes found in 112-114 must stay blocked, not quietly filled."""
    table = load_table()
    for root in ("ص م د", "ك ف أ", "و ق ب", "ن ف ث", "خ ن س"):
        rows = [v for k, v in table.items() if k == root or k.startswith(root + "|")]
        assert rows, f"{root} missing from the table"
        assert all(r["grade"] == "undetermined" or not r["english"] for r in rows), (
            f"{root} was filled in without evidence"
        )
