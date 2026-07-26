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

from .grammar import compose

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
        words, blocked = [], False
        ordered = sorted(by_verse[k], key=lambda x: x["position"])
        for idx, t in enumerate(ordered):
            prev = ordered[idx - 1] if idx else None
            row = resolve(t, table)
            if not row:
                words.append(f"⟦{t['text_no_tashkeel']}⟧")
                blocked = True
            elif row["grade"] == "judgement":
                words.append(f"*{compose(t, row['english'], prev)}*")
            else:
                words.append(compose(t, row["english"], prev))
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
