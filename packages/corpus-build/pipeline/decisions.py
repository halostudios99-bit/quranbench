"""The decision table and the renderer (docs/translation-method.md, Part 5).

Nothing here generates prose. The rendering is a lookup: every token resolves to a
row in a human-authored table, and the build emits the text. Same corpus version
plus same table always yields byte-identical output.

A decision is keyed most-specifically-first:

    root + lemma + pos   →  the usual case; distinguishes اسْم (name) from
                            سَماء (sky), both root س م و
    root + lemma         →  when part of speech does not change the English
    root                 →  when the whole root takes one word
    form                 →  particles and pronouns, which have no root

Each row carries a grade (docs/translation-method.md Rule 3) and the verse that
settled it. Rule 20: only `settled` and `supported` may be rendered; `judgement`
renders but is marked; `undetermined` blocks the verse.

Commands
--------
    python -m pipeline.decisions init      # write a skeleton for every key
    python -m pipeline.decisions coverage  # what is decided, and what it unlocks
    python -m pipeline.decisions render 1  # render a surah from the table
"""

from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

from .grammar import SUBJECT, compose

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "out"
TABLE = ROOT / "decisions" / "table.json"

GRADES = ("settled", "supported", "judgement", "undetermined")
RENDERABLE = ("settled", "supported", "judgement")  # Rule 20


def latest_version() -> str:
    return sorted(p.name[1:] for p in ARTIFACTS.iterdir() if p.name.startswith("v"))[-1]


def load_tokens(version: str) -> list[dict]:
    return [json.loads(l) for l in (ARTIFACTS / f"v{version}" / "tokens.jsonl").open(encoding="utf-8")]


def key_of(token: dict) -> str:
    """The most specific key this token could match."""
    m = token.get("morphology") or {}
    root, lemma, pos = m.get("root"), m.get("lemma"), m.get("pos")
    if root and lemma and pos:
        return f"{root}|{lemma}|{pos}"
    if root and lemma:
        return f"{root}|{lemma}"
    if root:
        return root
    lemma = (token.get("morphology") or {}).get("lemma")
    if lemma:
        return f"form:{token['text_no_tashkeel']}|{lemma}"
    return f"form:{token['text_no_tashkeel']}"


def candidate_keys(token: dict) -> list[str]:
    """Keys to try, most specific first."""
    m = token.get("morphology") or {}
    root, lemma, pos = m.get("root"), m.get("lemma"), m.get("pos")
    keys = []
    if root and lemma and pos:
        keys.append(f"{root}|{lemma}|{pos}")
    if root and lemma:
        keys.append(f"{root}|{lemma}")
    if root:
        keys.append(root)
    if lemma:
        keys.append(f"form:{token['text_no_tashkeel']}|{lemma}")
    keys.append(f"form:{token['text_no_tashkeel']}")
    return keys


def load_table() -> dict:
    if not TABLE.exists():
        return {}
    return json.loads(TABLE.read_text(encoding="utf-8"))


def save_table(table: dict) -> None:
    TABLE.parent.mkdir(parents=True, exist_ok=True)
    TABLE.write_text(
        json.dumps(table, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def resolve(token: dict, table: dict) -> dict | None:
    for k in candidate_keys(token):
        if k in table and table[k].get("english"):
            return table[k]
    return None


def render_verse(tokens: list[dict], table: dict, mark: bool = False) -> tuple[list[str], bool]:
    """Render one verse. Returns the words and whether anything blocked it."""
    parts, blocked = render_verse_parts(tokens, table, mark)
    return [word for word, _ in parts], blocked


def render_verse_parts(
    tokens: list[dict], table: dict, mark: bool = False
) -> tuple[list[tuple[str, dict | None]], bool]:
    """Render one verse, keeping each rendered word beside the row that produced it.

    The edition builder needs this correspondence to mark the words graded
    judgement. Token position will not do: one token can render as several words
    ("the All-Merciful"), and a word can be dropped entirely by the repetition
    rule, so the two sequences drift apart.

    This is the single rendering path. The fixtures used to carry their own copy
    of this loop, which meant a change to how production renders a verse could
    leave every test still passing.

    It is also where a frame rule lives that no single word can express. Arabic
    مِن after an elative is English "than", not "from" — أكبر من, أظلم ممن. The
    decision table marks which words are elatives, because the morphology does
    not: the corpus tags أظلم as a verb.
    """
    parts: list[tuple[str, dict | None]] = []
    blocked = False
    ordered = sorted(tokens, key=lambda t: t["position"])
    previous_row: dict | None = None

    for i, token in enumerate(ordered):
        row = resolve(token, table)
        if not row:
            parts.append((f"⟦{token['text_no_tashkeel']}⟧", None))
            blocked = True
            previous_row = None
            continue
        english = row["english"]
        morph = token.get("morphology") or {}

        # Rule 4: the frame decides the sense. خلا is "pass away" — قد خلت من
        # قبله الرسل — but خلا إلى is a different word, withdrawing apart with
        # someone (2:14 وإذا خلوا إلى شيطينهم). A row may name the words that
        # change its sense; nothing is guessed from context beyond what the row
        # itself declares.
        following = row.get("followed_by")
        if following and i + 1 < len(ordered):
            nxt = ordered[i + 1]
            nxt_lemma = (nxt.get("morphology") or {}).get("lemma")
            english = following.get(nxt["text_no_tashkeel"]) or following.get(nxt_lemma) or english

        # The frame can sit on either side. حَوْل is "a year" — إلى الحول — but
        # مِن حولك is "around you", and there the word that decides the sense
        # comes first.
        preceding = row.get("preceded_by")
        if preceding and i > 0:
            prv = ordered[i - 1]
            prv_lemma = (prv.get("morphology") or {}).get("lemma")
            english = preceding.get(prv["text_no_tashkeel"]) or preceding.get(prv_lemma) or english

        # A broken plural can be a different word from its singular. بَرّ is
        # dry land — 5:96 صيد البر against صيد البحر — but الأبرار, its plural,
        # is the dutiful (3:193 مع الأبرار). Only the row may say so.
        already_plural = False
        if row.get("plural") and ((morph.get("features") or {}).get("number")) == "plural":
            english = row["plural"]
            already_plural = True

        if previous_row and previous_row.get("elative") and english.split()[0] == "from":
            english = "than" + english[len("from"):]

        # إنكم ظلمتم states the subject twice; English states it once. Suppress
        # the verb's pronoun only when the word before ends in that same
        # pronoun, so a nominal predicate (إنكم لمشركون) keeps its subject.
        drop = False
        if previous_row and morph.get("pos") == "V":
            feats = morph.get("features") or {}
            subject = SUBJECT.get((feats.get("person"), feats.get("number", "singular")))
            if subject and previous_row["english"].split()[-1].lower() == subject.lower():
                drop = True

        word = compose(
            token,
            english,
            ordered[i - 1] if i else None,
            drop_subject=drop,
            already_plural=already_plural,
        )

        # آمن renders "trust in" and به renders "in it", so the two together said
        # "trust in in it". Where the repetition comes from our composition it is
        # dropped; where the Arabic itself repeats a word — وإلهكم إله, أمتكم أمة
        # — the lemmas match and both are kept, because the text said it twice.
        if parts and word:
            prev_lemma = (ordered[i - 1].get("morphology") or {}).get("lemma")
            if morph.get("lemma") != prev_lemma:
                tail = parts[-1][0].split()
                head = word.split()
                if tail and head and tail[-1].lower() == head[0].lower():
                    word = " ".join(head[1:])

        if word:
            marked = f"*{word}*" if mark and row["grade"] == "judgement" else word
            parts.append((marked, row))
        previous_row = row

    return parts, blocked


# ── commands ──────────────────────────────────────────────────────────────────

def cmd_init(tokens: list[dict]) -> None:
    """Create a blank row for every key, ordered by frequency so the most
    valuable decisions sort to the top of the file."""
    table = load_table()
    freq: Counter[str] = Counter(key_of(t) for t in tokens)
    added = 0
    for k, n in freq.most_common():
        if k not in table:
            table[k] = {"english": "", "grade": "", "evidence": "", "tokens": n}
            added += 1
        else:
            table[k]["tokens"] = n
    save_table(table)
    print(f"{len(table):,} keys in table ({added:,} new) -> {TABLE.relative_to(ROOT.parent.parent)}")


def cmd_coverage(tokens: list[dict]) -> None:
    table = load_table()
    decided = {k for k, v in table.items() if v.get("english") and v.get("grade") in RENDERABLE}

    tok_done = sum(1 for t in tokens if any(k in decided for k in candidate_keys(t)))
    by_verse: dict[tuple, list[dict]] = defaultdict(list)
    for t in tokens:
        by_verse[(t["surah"], t["slot"])].append(t)
    verses_full = sum(
        1 for v in by_verse.values()
        if all(any(k in decided for k in candidate_keys(t)) for t in v)
    )
    grades = Counter(v.get("grade") for v in table.values() if v.get("english"))

    print(f"keys decided   {len(decided):,} / {len(table):,}")
    print(f"words covered  {tok_done:,} / {len(tokens):,}  ({tok_done/len(tokens)*100:.1f}%)")
    print(f"verses whole   {verses_full:,} / {len(by_verse):,}  ({verses_full/len(by_verse)*100:.1f}%)")
    print("grades         " + ", ".join(f"{g}={n}" for g, n in grades.most_common()))

    blocking = Counter()
    for (s, slot), v in by_verse.items():
        for t in v:
            if not any(k in decided for k in candidate_keys(t)):
                blocking[key_of(t)] += 1
    print("\nkeys blocking the most verses:")
    for k, n in blocking.most_common(15):
        print(f"  {n:>5} verses   {k}")


def cmd_render(tokens: list[dict], surah: int) -> None:
    table = load_table()
    by_verse: dict[tuple, list[dict]] = defaultdict(list)
    for t in tokens:
        if t["surah"] == surah:
            by_verse[(t["surah"], t["slot"])].append(t)

    def order(k):
        return 0 if k[1] == "basmala" else int(k[1])

    for k in sorted(by_verse, key=order):
        words, blocked = render_verse(by_verse[k], table, mark=True)
        mark = "  [INCOMPLETE]" if blocked else ""
        print(f"{k[0]}:{k[1]}  {' '.join(words)}{mark}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=("init", "coverage", "render"))
    ap.add_argument("surah", nargs="?", type=int)
    ap.add_argument("--version", default=None)
    args = ap.parse_args()

    tokens = load_tokens(args.version or latest_version())
    if args.command == "init":
        cmd_init(tokens)
    elif args.command == "coverage":
        cmd_coverage(tokens)
    else:
        cmd_render(tokens, args.surah or 1)


if __name__ == "__main__":
    main()
