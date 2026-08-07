"""Turn a decision-table word into an inflected English word.

The table stores one base English word per key — "guide", "way", "favour". This
module attaches everything the Arabic marks morphologically: the definite
article, attached pronouns, plural, and verb person and tense. Without it the
renderer emits `guide way straight` where the Arabic says `guide us the straight
way`.

What it deliberately does NOT do is reorder words. Arabic word order is kept, so
the output reads stiffly and sometimes oddly. That is the honest behaviour for a
concordance rendering: reordering is interpretation, and it would hide which
English word came from which Arabic word. The reader can see the correspondence
one-to-one, which is the point.

Everything here reads the morphology segments already in the corpus. Those are an
outside source (Leeds QAC) and rendering therefore rests on them — recorded in
docs/translation-method.md, Rule 1.
"""

from __future__ import annotations

import re

# Attached pronouns, by person·gender·number.
OBJECT = {
    ("1", None, "singular"): "me", ("1", None, "plural"): "us",
    ("2", "M", "singular"): "you", ("2", "F", "singular"): "you",
    ("2", "M", "plural"): "you", ("2", "F", "plural"): "you",
    ("2", None, "dual"): "you two",
    ("3", "M", "singular"): "him", ("3", "F", "singular"): "her",
    ("3", "M", "plural"): "them", ("3", "F", "plural"): "them",
    ("3", None, "dual"): "them two",
}
POSSESSIVE = {
    "me": "my", "us": "our", "you": "your", "you two": "your",
    "him": "his", "her": "her", "them": "their", "them two": "their",
}
SUBJECT = {
    ("1", "singular"): "I", ("1", "plural"): "We",
    ("2", "singular"): "you", ("2", "plural"): "you", ("2", "dual"): "you two",
    ("3", "singular"): "he", ("3", "plural"): "they", ("3", "dual"): "they two",
}

# English is irregular; the table may later carry explicit forms. Until then a
# small list covers the verbs that actually recur in the corpus.
# Third-person singular present, where adding -s is wrong.
PRESENT_3S = {
    "be": "is", "have": "has", "do": "does", "say": "says", "go": "goes",
    "is not": "is not",
}

# Past participles, where they differ from the simple past. Used by the passive.
PARTICIPLE = {
    "beget": "begotten", "give": "given", "take": "taken", "see": "seen",
    "know": "known", "do": "done", "make": "made", "say": "said",
    "send": "sent", "write": "written", "cast": "cast", "find": "found",
    "forbid": "forbidden", "forget": "forgotten", "forgive": "forgiven", "eat": "eaten",
    "bear": "borne", "strike": "struck", "lead": "led", "bring": "brought",
    "spend": "spent", "stand": "stood", "hear": "heard", "teach": "taught",
    "leave": "left", "throw": "thrown", "speak": "spoken", "rise": "risen",
    "beget": "begotten",
}

PAST = {
    "be": "was", "say": "said", "know": "knew", "beget": "begot",
    "give": "gave", "take": "took", "come": "came", "make": "made",
    "see": "saw", "find": "found", "send": "sent", "teach": "taught",
    "sink": "sank", "withdraw": "withdrew", "write": "wrote", "eat": "ate",
    "do": "did", "hear": "heard", "fight": "fought", "spend": "spent",
    "stand": "stood", "strike": "struck", "leave": "left", "seek": "sought",
    "forbid": "forbade", "forget": "forgot", "forgive": "forgave", "bring": "brought",
    "go": "went", "lead": "led", "bear": "bore", "befall": "befell",
    "cast": "cast", "hold": "held", "keep": "kept", "feel": "felt",
    "flee": "fled", "sell": "sold", "buy": "bought", "fall": "fell",
    "rise": "rose", "speak": "spoke", "swear": "swore", "tear": "tore",
    "throw": "threw", "wear": "wore", "win": "won", "shine": "shone",
}

# Multi-syllable verbs whose final consonant doubles. Single-syllable ones are
# detected; these are the exceptions a rule cannot see.
DOUBLE = {"admit", "commit", "permit", "omit", "submit", "prefer", "refer",
          "occur", "compel", "repel", "expel", "rebel", "control", "regret"}

# Fixed predicates that are not verbs and must not be inflected at all. "is not"
# has no past; "excellent is" was being turned into "excellented is".
INVARIANT = {"is not", "excellent is", "wretched is", "perhaps", "almost"}
# Lemmas whose English already expresses the genitive link.
ABSORB_GENITIVE = {"غَيْر", "بَعْض", "كُلّ", "مِثْل", "أَهْل", "ذُو", "صاحِب", "آل", "عِند", "عالِم"}

PLURAL = {
    "one astray": "those astray", "one angered": "those angered",
    "one who leads astray": "those who lead astray", "envier": "enviers",
    "angel": "angels", "parent": "parents", "child": "children",
    "person": "people", "human": "humans", "all": "all", "Nasrani": "Nasara", "sky": "skies", "way": "ways",
    "path": "paths", "day": "days", "chest": "chests", "knot": "knots",
    "child": "children", "one who trusts": "those who trust",
    "one who rejects": "those who reject", "beings": "beings",
    "people": "people", "chests": "chests", "knots": "knots",
}


def _pronoun(features: dict) -> str | None:
    p = features.get("person")
    g = features.get("gender")
    n = features.get("number", "singular")
    for key in ((p, g, n), (p, None, n)):
        if key in OBJECT:
            return OBJECT[key]
    return None


def _plural_stem(word: str) -> str:
    if word.endswith(("s", "x", "ch", "sh")):
        return word + "es"
    if word.endswith("y") and word[-2:-1] not in "aeiou":
        return word[:-1] + "ies"
    return word + "s"


def _pluralise(word: str) -> str:
    if word in PLURAL:
        return PLURAL[word]
    # "companion of" pluralises its head; "good deed" pluralises its last word.
    # Getting this backwards produced "companion ofs of the blazing fire".
    if word.endswith(" of") or " of " in word:
        return _inflect_head(word, _plural_stem)
    return _plural_stem(word)


def _vowel_groups(word: str) -> int:
    return len(re.findall(r"[aeiouy]+", word))


def _inflect_head(word: str, rule) -> str:
    """Apply `rule` to the first word only.

    A rendering may be a phrase — "go astray", "ask help", "be able". The verb is
    its head; inflecting the whole string produced "go astrays" and "be ables",
    because the noun pluraliser was being reused and it works on the last word.
    """
    if word in INVARIANT:
        return word
    head, _, tail = word.partition(" ")
    return (rule(head) + " " + tail).strip()


def _past_stem(head: str) -> str:
    if head in PAST:
        return PAST[head]
    if head.endswith("e"):
        return head + "d"
    if head.endswith("y") and head[-2:-1] not in "aeiou":
        return head[:-1] + "ied"                       # carry -> carried
    if (
        head in DOUBLE
        or (_vowel_groups(head) == 1 and len(head) > 2
            and head[-1] not in "aeiouwxy" and head[-2] in "aeiou"
            and head[-3] not in "aeiou")
    ):
        return head + head[-1] + "ed"                  # bar -> barred
    return head + "ed"


def _past(word: str) -> str:
    if word in PAST:
        return PAST[word]
    return _inflect_head(word, _past_stem)


def _present_3s_stem(head: str) -> str:
    if head in PRESENT_3S:
        return PRESENT_3S[head]
    if head.endswith(("s", "x", "z", "ch", "sh", "o")):
        return head + "es"
    if head.endswith("y") and head[-2:-1] not in "aeiou":
        return head[:-1] + "ies"
    return head + "s"


def _present_3s(word: str) -> str:
    if word in PRESENT_3S:
        return PRESENT_3S[word]
    return _inflect_head(word, _present_3s_stem)


def _is_subject_marker(verb_feats: dict, suffix_feats: dict) -> bool:
    """Is this attached pronoun the verb's SUBJECT rather than its object?

    Arabic marks a perfect verb's subject with an attached pronoun — أَنْعَمْتَ is
    "you favoured", not "favoured you". The corpus tags that suffix PRON exactly
    like an object pronoun, so the two are told apart by agreement: when the
    suffix's person, gender and number match what the verb already carries, it is
    the subject and must not be emitted a second time.
    """
    if not verb_feats.get("person"):
        return False
    return all(
        suffix_feats.get(k) == verb_feats.get(k)
        for k in ("person", "number")
        if suffix_feats.get(k) is not None
    )


def compose(
    token: dict,
    english: str,
    previous: dict | None = None,
    drop_subject: bool = False,
    already_plural: bool = False,
) -> str:
    """Inflect `english` according to what the Arabic marks.

    `previous` is the preceding token, needed only to detect a genitive
    construct: two nouns in sequence where the second is GEN means "X of Y".

    `drop_subject` suppresses the verb's subject pronoun. Arabic states it twice
    where English states it once — إنكم ظلمتم is "indeed you wronged", not
    "indeed you you wronged". The caller decides, because only it can see the
    word before.
    """
    m = token.get("morphology") or {}
    feats = m.get("features") or {}
    segs = m.get("segments") or []
    pos = m.get("pos")

    # Rootless words — particles, pronouns, prepositions with an attached
    # pronoun — are seeded whole and returned untouched. لَهُۥ is one indivisible
    # decision, "for him"; letting the layer add "for" from the ل prefix and
    # "him" from the ه suffix produced "for for him".
    if not m.get("root"):
        return english

    prefixes = [s for s in segs if s.get("type") == "prefix"]
    suffixes = [s for s in segs if s.get("type") == "suffix"]

    has_det = any(s.get("pos") == "DET" for s in prefixes)
    conj = next((s for s in prefixes if s.get("pos") == "CONJ"), None)
    prep = next((s for s in prefixes if s.get("pos") == "P"), None)
    pron_suffix = next((s for s in suffixes if s.get("pos") == "PRON"), None)

    out = english

    if pos == "V":
        tense = feats.get("tense")
        person = feats.get("person")
        number = feats.get("number", "singular")
        # 112:3 لم يلد ولم يولد — the second verb is passive. Without this both
        # render "he begets" and the verse says the opposite of what it says.
        if out in INVARIANT:
            # ليس, نعم, بئس and عسى are not inflected and take no subject
            # pronoun: "he wretched is" was the verb machinery running anyway.
            if conj:
                out = ("and " if (conj.get("lemma") or "") == "و" else "so ") + out
            return out
        elif out.startswith("be ") and str(feats.get("voice", "")).lower().startswith("pass"):
            # A rendering that is already passive — "be reminded", "be turned
            # away" — must not also take the auxiliary, or it doubles it.
            be = "was" if tense == "PERF" else ("are" if number == "plural" else "is")
            out = be + " " + out[len("be "):]
            if pron_suffix:
                sfeats = pron_suffix.get("features") or {}
                if not _is_subject_marker(feats, sfeats):
                    obj = _pronoun(sfeats)
                    if obj:
                        out = f"{out} {obj}"
            if conj:
                out = ("and " if (conj.get("lemma") or "") == "و" else "so ") + out
            return out
        elif str(feats.get("voice", "")).lower().startswith("pass"):
            participle = PARTICIPLE.get(out) or _past(out)
            for pron in ("he ", "they ", "I ", "We ", "you "):
                if participle.startswith(pron):
                    participle = participle[len(pron):]
            be = "was" if tense == "PERF" else ("are" if number == "plural" else "is")
            out = f"{be} {participle}"
            if pron_suffix:
                sfeats = pron_suffix.get("features") or {}
                if not _is_subject_marker(feats, sfeats):
                    obj = _pronoun(sfeats)
                    if obj:
                        out = f"{out} {obj}"
            if conj:
                out = ("and " if (conj.get("lemma") or "") == "و" else "so ") + out
            return out
        if tense == "PERF":
            out = _past(out)
            # "be" is the one English verb whose past agrees with its subject.
            if out.split()[0] == "was" and (number != "singular" or person == "2"):
                out = "were" + out[3:]
            subj = None if drop_subject else SUBJECT.get((person, number))
            if subj:
                out = f"{subj} {out}"
        elif tense == "IMPF":
            subj = None if drop_subject else SUBJECT.get((person, number))
            if number == "plural" or person in ("1", "2"):
                verb = out
            else:
                verb = _present_3s(out)
            out = f"{subj} {verb}" if subj else verb
        # IMPV: bare stem, which is already the base form
        if pron_suffix:
            sfeats = pron_suffix.get("features") or {}
            if not _is_subject_marker(feats, sfeats):
                obj = _pronoun(sfeats)
                if obj:
                    out = f"{out} {obj}"
    else:
        # Only nouns pluralise. Relatives and particles carry a number feature
        # too, and pluralising them produced "those whoms".
        if (
            pos == "N"
            and feats.get("number") == "plural"
            and not already_plural
            and not out.endswith("s")
        ):
            out = _pluralise(out)
        if pron_suffix:
            obj = _pronoun(pron_suffix.get("features") or {})
            if obj:
                if pos == "P":            # عليهم — upon them
                    out = f"{out} {obj}"
                else:                      # ربه — his Sustainer
                    out = f"{POSSESSIVE.get(obj, obj)} {out}"
        elif has_det and not out.startswith(("those ", "the ")):
            # "the denied", "the most beautiful" and "the dutiful" carry their
            # own article — a word whose English needs one is not given a second.
            out = f"the {out}"

    if prep:
        lemma = (prep.get("lemma") or "").strip()
        out = {"ب": "by", "ل": "for", "ك": "as"}.get(lemma, "") + " " + out
        out = out.strip()
    # Genitive construct: نoun + noun-in-GEN is "X of Y". Only when the second
    # noun carries no preposition or article of its own to explain the case.
    prev_m = (previous or {}).get("morphology") or {}
    prev_feats = prev_m.get("features") or {}
    if (
        previous is not None
        and pos == "N"
        and feats.get("case") == "GEN"
        and not feats.get("adjective")        # an adjective agrees, it is not possessed
        and not prev_feats.get("adjective")
        and not prep
        and not conj
        and prev_m.get("pos") == "N"
        # Some words already carry the relation in their English ("other than"),
        # so adding "of" doubles it.
        and (prev_m.get("lemma") not in ABSORB_GENITIVE)
    ):
        out = f"of {out}"

    if conj:
        out = ("and " if (conj.get("lemma") or "") == "و" else "so ") + out

    return out
