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

from pipeline.decisions import RENDERABLE, load_table, render_verse, resolve

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
    """Renders through the production path, not a copy of it."""
    words, blocked = render_verse(tokens, table)
    assert not blocked, f"undecided token in a fixture verse: {' '.join(words)}"
    return " ".join(words)


# 112 pins the passive voice and the atomic-particle rule. 112:2 and 112:4 stay
# blocked on hapaxes (صمد, كفوا) and are deliberately absent.
EXPECTED_112 = {
    "1": "say He Allah one",
    "3": "not he begets not is begotten",
}

EXPECTED = {
    "1": "by name Allah the All-Merciful the Merciful",
    "2": "the praise for Allah Sustainer of the beings",
    "3": "the All-Merciful the Merciful",
    "4": "owner of Day of the accountability",
    "5": "You alone We serve and You alone We ask help",
    "6": "guide us the way the straight",
    # Updated when ض ل ل and غ ض ب were re-decided per lemma: ضالّ is a person
    # who is astray, not the abstract "astray"; مَغْضُوب likewise.
    "7": (
        "way those whom you favoured upon them other than the one angered "
        "upon them and not those astray"
    ),
}


@pytest.mark.parametrize("slot", sorted(EXPECTED))
def test_al_fatiha_renders_exactly(slot: str, verses) -> None:
    assert render(verses[slot], load_table()) == EXPECTED[slot]


@pytest.mark.parametrize("slot", sorted(EXPECTED_112))
def test_surah_112_passive_voice(slot: str) -> None:
    """لم يلد ولم يولد — the second verb is passive. Rendering both as
    "he begets" made the verse say the opposite of what it says."""
    tokens = [
        json.loads(line)
        for line in (ARTIFACTS / f"v{_latest()}" / "tokens.jsonl").open(encoding="utf-8")
    ]
    verse = sorted(
        (t for t in tokens if t["surah"] == 112 and t["slot"] == slot),
        key=lambda t: t["position"],
    )
    assert render(verse, load_table()) == EXPECTED_112[slot]


def test_min_after_an_elative_is_than() -> None:
    """أكبر من is "greater than", not "greater from".

    No word can carry this on its own — it depends on what precedes it — and the
    morphology cannot supply it either, because the corpus tags أظلم as a verb.
    The table marks the elatives and the renderer reads the mark.
    """
    table = load_table()
    tokens = [
        json.loads(line)
        for line in (ARTIFACTS / f"v{_latest()}" / "tokens.jsonl").open(encoding="utf-8")
    ]
    elative = next(
        t for t in tokens
        if (row := resolve(t, table)) and row.get("elative")
    )
    after = next(
        t for t in tokens
        if (row := resolve(t, table)) and row["english"].split()[0] == "from"
    )
    pair = [dict(elative, position=1), dict(after, position=2)]
    words, _ = render_verse(pair, table)
    assert words[1].split()[0] == "than", f"expected 'than', got {words[1]!r}"

    alone, _ = render_verse([dict(after, position=1)], table)
    assert alone[0].split()[0] == "from", "the rule must only fire after an elative"


def test_no_doubled_words() -> None:
    """`and and`, `upon them them` — the shape of every bug so far was a word
    emitted by both the decision table and the grammar layer."""
    table = load_table()
    for text in EXPECTED.values():
        parts = text.split()
        doubled = [a for a, b in zip(parts, parts[1:]) if a == b]
        assert not doubled, f"doubled word in {text!r}: {doubled}"


def test_no_decided_form_key_covers_two_words() -> None:
    """An unvocalised surface form can be several different words.

    form:ألا was one decision, "indeed", standing over four: أَلا (behold),
    أَن+لا (that not), أَنّ+لا, and لا (not) — so 60 of its 99 tokens rendered a
    word the text does not say. form:من, "from", covered مَن (who) for 393
    tokens. Nothing failed; the verses simply read wrong.

    Rootless words are now keyed by form AND lemma. A bare form key that still
    carries English while more than one lemma shares that form is the same
    mistake waiting to happen again.
    """
    from collections import defaultdict

    table = load_table()
    lemmas: dict[str, set[str]] = defaultdict(set)
    for key in table:
        if key.startswith("form:") and "|" in key:
            base, lemma = key.split("|", 1)
            lemmas[base].add(lemma)

    offenders = [
        f"{key} = {row['english']!r} covers {sorted(lemmas[key])}"
        for key, row in table.items()
        if key.startswith("form:") and "|" not in key and row.get("english")
        and len(lemmas.get(key, ())) > 1
    ]
    assert not offenders, "ambiguous form key still decided:\n  " + "\n  ".join(offenders)


def test_no_word_is_emitted_twice_unless_the_arabic_repeats_it() -> None:
    """Every complete verse, checked for an adjacent repeated word.

    "trust in" followed by "in it" said "trust in in it"; "companion of"
    pluralised to "companion ofs"; إنكم ظلمتم said "indeed you you wronged".
    Each was a different bug with one signature, and Al-Fatiha shows none of
    them. The Arabic does sometimes repeat a word — وإلهكم إله, أمتكم أمة,
    ءايت الله والله — and those are kept, so the check is that a repeat must
    come from two tokens of the SAME lemma.
    """
    from collections import defaultdict

    from pipeline.decisions import render_verse, resolve

    table = load_table()
    tokens = [
        json.loads(line)
        for line in (ARTIFACTS / f"v{_latest()}" / "tokens.jsonl").open(encoding="utf-8")
    ]
    by_verse: dict[tuple, list[dict]] = defaultdict(list)
    for token in tokens:
        by_verse[(token["surah"], token["slot"])].append(token)

    offenders = []
    for ref, verse in by_verse.items():
        words, blocked = render_verse(verse, table)
        if blocked:
            continue
        parts = " ".join(words).split()
        if not any(a == b for a, b in zip(parts, parts[1:])):
            continue
        ordered = sorted(verse, key=lambda t: t["position"])
        lemmas = [(t.get("morphology") or {}).get("lemma") for t in ordered]
        if any(a == b and a is not None for a, b in zip(lemmas, lemmas[1:])):
            continue                      # the text itself says it twice
        offenders.append(f"{ref[0]}:{ref[1]}  {' '.join(words)}")

    assert not offenders, "word emitted twice:\n  " + "\n  ".join(offenders[:10])


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


def test_hapaxes_rest_on_general_arabic_and_say_so() -> None:
    """Rule 22: a hapax may be rendered from ordinary Arabic lexis, but only at
    judgement grade and only if its evidence records that it does not come from
    the corpus. Promoting one to settled would hide the weakest words in the
    translation among the strongest."""
    table = load_table()
    for root in ("ص م د", "ك ف أ", "و ق ب", "ن ف ث", "خ ن س"):
        rows = [v for k, v in table.items() if k == root or k.startswith(root + "|")]
        assert rows, f"{root} missing from the table"
        for r in rows:
            if not r.get("english"):
                continue
            assert r["grade"] == "judgement", f"{root} must stay judgement"
            assert "Rule 22" in r.get("evidence", ""), (
                f"{root} renders from general Arabic but does not say so"
            )


def test_no_root_level_over_seeding() -> None:
    """One English word must not be pasted across a root's different lemmas.

    Seeding at root level rather than per lemma silently flattened 16 roots:
    قَوْم (383 tokens, "people") rendered as "straight" because it shares ق و م
    with مُسْتَقِيم; مَلَك ("angel") rendered as "owner"; and مُحَمَّد, a proper
    name, rendered as "praise". Nothing failed — the output was simply wrong
    everywhere those words appear.

    A root may legitimately take one English word across lemmas that are true
    inflections of each other. It may not do so across parts of speech, which is
    the signature of the mistake.
    """
    from collections import defaultdict

    table = load_table()
    by_root: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    for key, row in table.items():
        if row.get("english") and "|" in key:
            by_root[key.split("|")[0]].append((key, row))

    offenders = []
    for root, rows in by_root.items():
        if len(rows) < 2:
            continue
        englishes = {r["english"] for _, r in rows}
        lemmas = {k.split("|")[1] for k, _ in rows if "|" in k}
        # A verb and its own noun may share an English word — "promise" is both
        # وَعَدَ and وَعْد. Two lemmas of the SAME part of speech sharing one
        # rendering is the mistake this catches.
        pos_tags = [k.split("|")[2] for k, _ in rows if k.count("|") == 2]
        if len(englishes) == 1 and len(set(pos_tags)) == len(pos_tags):
            continue
        # A masculine noun and its feminine are one word: مُؤْمِن and مُؤْمِنَة both
        # render "one who trusts". Strip the ة and see whether anything is left.
        if len({lemma.rstrip("ةَُِ") for lemma in lemmas}) == 1:
            continue
        # One lemma tagged with two parts of speech is not over-seeding —
        # يَوْم is the same word whether tagged N or T. Distinct lemmas sharing
        # one English word is the real signature.
        if len(englishes) == 1 and len(lemmas) > 1:
            offenders.append(f"{root} -> {englishes.pop()!r} across {sorted(lemmas)}")

    assert not offenders, "root-level over-seeding:\n  " + "\n  ".join(offenders)


def test_english_inflection_is_well_formed() -> None:
    """Every verb in the table must inflect into real English.

    The table stores base forms and the grammar layer inflects them, so a single
    missing rule corrupts every verse a verb appears in. Three rules were absent
    at once and the output carried `carryed`, `writed` and `admited`; separately,
    third-person present was being built by the NOUN pluraliser, which inflects
    the last word of a phrase rather than the verb, giving `go astrays`,
    `ask helps` and `be ables`.

    The check is deliberately crude — a real English past tense is not formed by
    gluing "ed" onto a stem that needed something else — but it catches exactly
    the shape of every one of those bugs.
    """
    from pipeline.grammar import INVARIANT, _past, _present_3s

    table = load_table()
    verbs = {v["english"] for k, v in table.items() if v.get("english") and k.endswith("|V")}

    bad = []
    for verb in sorted(verbs):
        if verb in INVARIANT:
            continue
        head = verb.split()[0]
        past, present = _past(verb), _present_3s(verb)
        # -ed on a stem ending in a consonant+y, or in e, or a doubling stem.
        if past.split()[0] == head + "ed" and (
            head.endswith("e") or (head.endswith("y") and head[-2:-1] not in "aeiou")
        ):
            bad.append(f"{verb!r} -> past {past!r}")
        # The verb must be the word that changed, not the tail of the phrase.
        if " " in verb and present.split()[1:] != verb.split()[1:]:
            bad.append(f"{verb!r} -> present {present!r} inflects the wrong word")
        if present.split()[0] == head and head not in ("is", "was"):
            bad.append(f"{verb!r} -> present {present!r} did not inflect")

    assert not bad, "malformed English inflection:\n  " + "\n  ".join(bad)


def test_proper_names_are_not_translated() -> None:
    """محمد is a name, not the noun 'praise' that shares its root."""
    table = load_table()
    for key, row in table.items():
        if key.endswith("|PN") and row.get("english"):
            assert row["english"][0].isupper(), (
                f"{key} is a proper name but renders as {row['english']!r}"
            )
