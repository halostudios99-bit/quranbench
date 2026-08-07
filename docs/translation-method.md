# Translation method — strict rules

_Version 0.3, 26 July 2026. Derived from working 33:56, 2:78, 9:97 and 18:66 by hand._

This document defines how a quranbench rendering is produced. It exists because
every rule below was written after an error — most of them made during the session
that produced this file. Each rule names the error it prevents, so nobody is
tempted to relax it without understanding what it cost.

The output of this method is **not a translation in the literary sense**. It is a
rendering constrained by evidence, and it will read stiffly. That is correct.

---

## Part 1 — What counts as evidence

### Rule 1. Only the Quran

Permitted: the consonantal Arabic text, and the distribution of its words.

**Forbidden**: tafsir, hadith, existing Quran translations, and any commentary
tradition. Morphological tag sets (including the Leeds QAC tags in this corpus)
are an outside source and must be declared wherever a decision rests on them.

**Permitted as a last resort, under Rule 22**: the ordinary lexical meaning of
Arabic as a language. Arabic is a language before it is a scripture, and knowing
what a word means carries no interpretive tradition with it. Such a decision is
graded `judgement` and must say so.

> **Error this prevents.** Mid-session I asserted "the classical exegetical
> tradition is against this reading". That is tafsir, it was stated without
> evidence, and it had no place in the output. Separately, I reported "root is ن ب أ"
> and "this is a form II verb" — both taken from the Leeds tags, not from the text.

A claim produced by pointing at Arabic words in the Quran is the strongest kind and
is what this method is for. Where the corpus cannot settle a word, Rule 22 governs:
general Arabic may fill the gap, labelled as an outside judgement and never
presented as a finding of the text.

### Rule 2. Roots are derived, never assumed

Search on root letters **allowing weak letters, long vowels and affixes to
intervene**. Never search a literal substring.

> **Error this prevents.** I searched for the substring `عرب` to find every
> occurrence of that root. `ٱلأعراب` is spelled أ‑ع‑ر‑**ا**‑ب — an alif sits between
> ر and ب, so the substring never matched and my search returned nothing. I
> concluded there was no link and invented a rendering from context. One
> mis-specified search silently removed the decisive evidence.

Any root-level search must be re-run with an interposing-letter pattern before its
result is trusted. A search returning *no* connection is the most dangerous kind
and must always be re-run.

### Rule 3. Confidence is part of the output

Every rendered word carries a grade, published with it:

| Grade | Condition |
| --- | --- |
| **Settled** | The text itself fixes the sense — a self-gloss, an explicit contrast, or a frame that excludes all alternatives |
| **Supported** | Consistent distribution across several occurrences, no counter-instance |
| **Judgement** | Distribution is compatible but does not force it; the translator chose |
| **Undetermined** | Too few occurrences, or the evidence pulls two ways |

**Undetermined is a permitted output.** Publishing "undetermined" is always better
than publishing a guess that looks settled.

---

## Part 2 — How to establish a sense

### Rule 4. The frame decides the sense, not the form

For every occurrence, record what **immediately follows** — preposition, object
type, or nothing. Group by frame before assigning any meaning.

> **Worked case.** `يصلون` occurs in four incompatible senses, separated only by
> what follows it:
> - `+ إلى` → reaching (4:90, 11:70, 11:81, 28:35)
> - `+ نارا / سعيرا / سقر / ـها` → entering fire (4:10, 74:26, 87:12, 88:4, 111:3 …)
> - `+ فى ٱلمحراب`, `+ معك`, or bare → the ritual (3:39, 4:102, 75:31, 87:15, 96:10)
> - `+ على` → 9:84, 9:103, 33:43, 33:56 — five tokens, four verses
>
> Identical letters. The frame is the whole discriminator.

A sense established in one frame **may not be carried into another frame**.

### Rule 5. Consonantal collision check

Before assigning a sense, list every distinct form sharing the skeleton and confirm
they belong to the same root. Different roots routinely share consonants.

> **Worked case.** The skeleton `صل` returns 102 distinct forms and 363 tokens,
> spanning at least six roots — ص ل و, ص ل ي (burning), ص ل ح (righteousness),
> ف ص ل (separating), ص ل ب (crucifixion), و ص ل (joining), plus صلصال (clay) and
> بصل (onion). Assigning one meaning to the skeleton would corrupt all of them.
>
> **The decisive technique**: 13:21 contains both `يصلون` and `يوصل` in one verse.
> The و is *visible* in يوصل, proving that root carries و as its **first** radical
> (و ص ل). The 33:56 family carries و as its **last** (صلوة, صلوا). Mirror roots,
> distinguished by the text itself.

Where two roots collide, the text usually exposes the difference somewhere. Find
that verse before proceeding.

### Rule 6. Self-glossing verses outrank everything

Where the Quran states the effect, purpose or definition of a word, that governs.

> **Worked cases.**
> - 9:103 — `إن صلوتك سكن لهم`. The verse states what the act does.
> - 33:43 — `ليخرجكم من ٱلظلمت إلى ٱلنور`. A purpose clause attached to the same verb.
> - 2:111 — people make a claim, then `تلك أمانيهم`, then `قل هاتوا برهنكم`. أمانى is
>   defined by being opposed to proof.

Index these. They are the strongest evidence the text offers and they are rare.

### Rule 7. Same-sentence contrast is evidence

Where a sentence sets two words against each other, each constrains the other.

> **Worked case.** 2:78 opens `لا يعلمون` and closes `وإن هم إلا يظنون`. Know against
> assume, inside one sentence. No outside source needed.

### Rule 8. The subject test

If the subject of a verb is Allah, any sense requiring a creature is excluded.

> **Worked case.** In the `على` frame the subject is Allah (33:43, 33:56). Whatever
> that verb is, it is not an act of worship. This single observation did more work
> than the rest of the analysis combined.

Apply the same test to angels, and to the messenger acting upon people (9:103).

### Rule 9. Never collapse two distinct words into one English word

If the Quran has a separate word for a concept, a different word does not mean that
concept. One Arabic word, one English word, held consistently across the whole text.

> **Error this prevents.** I rendered `ٱلأعراب` as "desert dwellers". But the Quran
> already has that word — `ٱلبدو` (12:100). Worse, 33:20 uses **both in one phrase**:
> `يودوا لو أنهم بادون **فى** ٱلأعراب`. You can only be "out in the open *among*" a
> group if the group is not itself the open-country people. The verse I cited as my
> evidence actually refuted my reading.

Before fixing an English word, search the Quran for that concept. If another Arabic
word already carries it, yours does not.

> **Second worked case — رشد (18:66).** The obvious English is "guidance". The text
> forbids it: 72:2 `يهدى إلى ٱلرشد` and 40:38 `أهدكم سبيل ٱلرشاد` both have هدى
> leading *to* رشد. Guidance is the guiding; رشد is what you arrive at. Two
> distinct Arabic words, so two distinct English words.
>
> The same rule kills a second candidate. "Logic" fails on 72:21 —
> `لا أملك لكم ضرا ولا رشدا` — where رشد is paired against ضر, harm. Logic is not
> the opposite of harm. And the Quran already has its reasoning words: يعقلون,
> يتفكرون, يتدبرون, أولى الألباب.
>
> What survives: 2:256 `قد تبين ٱلرشد من ٱلغى` and 7:146 opposing سبيل ٱلرشد to
> سبيل ٱلغى. Being on the right track, as against going astray.

### Rule 10. Cognate accusatives mark intensity, not content

A verbal noun repeating its own verb's letters is an intensifier. Render as
degree — "fully", "completely" — never as additional meaning.

> **Worked case.** `وسلموا تسليما` (33:56). تسليما occurs only twice in the Quran,
> and the other is 4:65 — `ويسلموا تسليما`, in a context of accepting a judgement
> without resistance. Two occurrences, same construction: the parallel settles it.

### Rule 11. Hapax discipline

A word occurring once or twice, with no informative frame and no parallel, is
**Undetermined**. Say so.

> **Worked case.** `أجدر` (9:97). The only other ج د ر in the Quran is `جدر`, walls
> (59:14). The corpus cannot settle it, and I said so rather than dressing up a
> guess.

### Rule 12. Read the neighbours before fixing a sense

Check at least three verses either side. Context within a passage is Quranic
evidence and is frequently decisive.

> **Worked case.** 9:97 calls the Arabs `أشد كفرا ونفاقا`. Two verses later, 9:99:
> `ومن ٱلأعراب من يؤمن بٱلله وٱليوم ٱلـاخر`. The passage qualifies itself.

### Rule 13. A comparative is not a universal

`أشد`, `أجدر`, `خير من` and similar compare. They do not describe every member of a
group. Render the comparison, never a verdict.

---

## Part 3 — Producing the rendering

### Rule 14. Do not add, do not drop

Every Arabic word must be accounted for. Nothing may appear in English that has no
Arabic behind it.

> **Error this prevents.** A draft rendering of 33:56 dropped `إن` — an emphatic
> particle sitting on the page. Strictness about not adding must be matched by
> strictness about not removing.

No bracketed interpretive insertions. If a word must be supplied for English to
work, mark it and record why.

### Rule 15. Where English has no equivalent, say so

Do not paraphrase silently. Either transliterate and gloss, or state in the notes
that the English is an approximation.

> **Error this prevents.** "Outlying folk" was a paraphrase presented as a
> translation. I should have flagged that I was describing rather than translating.

### Rule 16. One decision per root × frame, applied everywhere

Decisions are made at the cluster level and applied to every occurrence. A word
rendered one way in surah 2 is rendered the same way in surah 90, or the decision
is revised everywhere at once.

This is the property no human translator can hold across 77,881 tokens, and it is
the main advantage of doing it this way.

### Rule 17. Ship the query with the claim

Every rendering publishes the search that produced it, the corpus version, and the
token identifiers of its evidence. A reader must be able to disagree with the
evidence rather than with the translator.

### Rule 18. State counter-evidence

Where a defensible alternative survives the evidence, publish it alongside. Where
the rendering departs from what other editions do, say so plainly — not to defer to
them, but so the reader knows a departure has occurred.

---

### Rule 19. Render every word; show confidence inline, never as a gap

A published verse is rendered **completely**. No holes, no ellipses.

This is in tension with Rule 3, which permits "Undetermined" — so the tension is
resolved by *display*, not by omission. Every word is rendered; words below
**Supported** carry a visible mark, and the mark links to the evidence. A settled
word looks ordinary; a judgement call announces itself.

The reason is practical: a verse travels as a screenshot, and a footer disclaimer
does not travel with it. Per-word marking is the only caveat that survives being
copied.

**Consequence:** a verse may only be published once every word in it has a decision.
Publish fewer verses, complete, rather than more verses with gaps. Coverage grows;
completeness per verse never regresses.

### Rule 20. A grade must block, or it is decoration

A word graded **Judgement** or **Undetermined** may not appear in a published
rendering. Resolve it, or do not publish the verse it sits in.

> **Error this prevents.** In the Al-Fatiha pilot I graded `صراط` as Judgement —
> explicitly noting that صراط, سبيل and طريق all mean a way and that I had not
> earned the distinction — and then put "road" in the rendering anyway. Flagging a
> problem and shipping it regardless is worse than not noticing, because the grade
> creates false assurance that something was checked.

Grades gate publication. Nothing below Supported reaches a reader.

### Rule 21. Resolve competing words as a set, never one at a time

Where several Arabic words compete for the same English word, decide the **whole
set together** before assigning any of them.

> **Worked case.** صراط (45 tokens) is **never plural**. سبيل (176) pluralises
> freely — سبل, ٱلسبل, سبلا, سبلنا. طريق (11) pluralises too — طرائق.
>
> **6:153 puts the first two in one sentence and opposes them**:
> `وأن هذا صرطى مستقيما فٱتبعوه ولا تتبعوا ٱلسبل` — follow my صراط, singular; do
> not follow the سبل, plural. 5:16 repeats the shape: the many سبل of peace lead
> to one صراط.
>
> Resolved as a set: صراط = *way* (always singular), سبيل = *path* (pluralises),
> طريق = *track*. Deciding any one of them alone would have produced a collision
> with the other two.

The unit of decision is the competing set, not the individual word.

---

### Rule 22. General Arabic is a permitted fallback; religious sources never are

Where the corpus cannot settle a word — a hapax, or a frame with no informative
distribution — the **ordinary lexical meaning of the Arabic** may be used. It is
graded `judgement`, marked in the rendering, and its evidence line must record
that it rests on general Arabic rather than on the text.

The line this draws is the whole point of the rule:

| Permitted | Forbidden |
| --- | --- |
| What a word means in Arabic as a language | Tafsir |
| Morphological pattern and derivation | Hadith |
| Cognate forms elsewhere in Arabic | Any existing Quran translation |
| | Any commentary tradition |

Arabic is a language before it is a scripture. Knowing that كُفُؤ means *equal*, or
that وَقَبَ means *to sink in*, is lexical knowledge of the same kind as knowing
what a Latin word means — it carries no interpretive tradition with it. Tafsir is a
reading *of the Quran*, and importing one is precisely the deviation this method
exists to remove.

This replaces the earlier practice of leaving hapaxes permanently blocked, which
made complete coverage unreachable. Nothing is guessed: a word with no lexical
meaning available still stays `undetermined`.

## Part 5 — The engine

The renderer is not a translator. It is a lookup.

```
decision table  →  build step  →  rendering artifact  →  site + downloads
(you author)       (deterministic)   (checksummed, versioned)
```

**Nothing stores translated prose.** What is stored is a table of decisions —
`root × frame → English + grade + evidence token ids`. The build step walks the
corpus, looks up each token's cluster, and emits all 6,236 verses.

Properties this buys, all of which the project already claims elsewhere:

- **Reproducible.** Same corpus version + same decision table = byte-identical
  output. Verifiable by a third party, like the corpus itself.
- **Consistent.** One decision applies to every occurrence. A human translator
  cannot hold that across 77,881 tokens; a table does it by construction.
- **Diffable.** Change one row, rebuild, and see exactly which verses moved and why.
- **Revertible.** The table is data under version control, not prose in a document.

**No model generates text at any point.** This is the answer to the CLAUDE.md rule 7
question in Part 4, and it is also why the edition must not be called
"AI-generated": the machine indexes and substitutes, a human decides. Naming it
after the machine would claim the opposite of what makes it defensible.

### Scale of the work (corpus v0.8.0)

| | |
| --- | --- |
| Total tokens | 77,881 |
| Tokens with no root — pronouns, particles, names | 27,165 (35%) — a short closed list |
| Tokens with a root | 50,716 |
| Distinct roots | 1,651 |

Coverage by decision count, rooted tokens only:

| Decisions | Covered |
| --- | --- |
| top 50 roots | 46.6% |
| top 100 | 61.2% |
| top 200 | 76.1% |
| top 300 | 83.7% |
| top 500 | 91.8% |
| top 800 | 96.6% |
| all 1,651 | 100% |

Frames multiply some roots, so the realistic total is **2,500–3,500 decisions**.
Working order: the closed list of particles first (35% of the text, and the easiest),
then roots by descending frequency.

### Part 5b — What the engine grew during the work (completed 7 August 2026)

The estimate above was close: the finished table holds **5,400 decided keys**
covering all 77,881 tokens and all 6,348 verses. Getting there forced five
mechanisms that the original design did not anticipate, each added only when a
real word could not be decided honestly without it:

- **Lemma-qualified form keys.** An unvocalised surface form can be several
  different words: `form:من` covered both مِن (from) and مَن (who) — 393 tokens
  reading wrongly with nothing failing. Rootless words are now keyed by form
  *and* lemma, and a guard rejects any bare form key that still spans two lemmas.
- **Forward frames (`followed_by`).** Rule 4 as machinery: a row may name the
  words that change its sense. خلا is *pass away*, but خلا إلى is *withdraw
  apart with* (2:14). The row declares its own trigger; nothing is inferred.
- **Backward frames (`preceded_by`).** The deciding word can come first: حَوْل
  is *a full term*, but مِن حولك is *around you*.
- **Number-conditioned renderings (`plural`).** A broken plural can be a
  different word: بَرّ is *dry land* (5:96, set against the sea), but its
  plural الأبرار is *the dutiful* (3:193). Only the row may say so.
- **Elative marking.** Arabic مِن after an elative is English *than*, not
  *from* (أكبر من). The morphology cannot supply this — the corpus tags أظلم
  as a verb — so the table marks elatives and the renderer reads the mark.

Two policies hardened during the run:

- **Rule 22 at scale.** 1,563 keys — 29% of the decided vocabulary — are words
  occurring once in the Quran. A frame cannot settle a word that appears a
  single time, so each rests on general Arabic, is graded `judgement`, records
  that fact in its evidence, and is marked in the reader. An early batch
  graded 397 hapaxes `supported`; it was reverted the same hour, because
  hiding the weakest words among the strongest is the failure Rule 20 exists
  to prevent. The full list is served at `/review`.
- **The table stores bare words.** The renderer supplies everything the Arabic
  marks — articles, possessives, number, tense. Seeding "your station" made
  6:135 read "upon your your station". A guard now rejects any rooted row
  whose English begins with a possessive, and the batch-apply step strips them
  mechanically.

The rendered edition ships as `en-qb-v1` beside the corpus releases (not inside
one — it is derived, not sourced), hash-locked to the decision table that
produced it, under CC BY-SA 4.0.

---

## Part 3b — Who decides what

_Agreed 26 July 2026, recorded here so it is visible rather than discovered._

The maintainer delegates routine decisions and retains the ones that carry weight.

**Claude decides, without review:** concrete vocabulary where the frame is
unambiguous and no competing word exists — أرض, يوم, سماء, جاء, يد, قلب. The
large majority of the 5,362 keys.

**The maintainer decides:**

1. **Theologically weighted roots** — كفر, أمن, ظلم, دين, عبد, حق, تقوى and
   roughly thirty others.
2. **Rule 21 collisions**, where several Arabic words compete for one English
   word and choosing for one forces the rest.
3. **Anything graded below Supported.**

The reason for the split, stated plainly: a model's English carries the priors of
the translations this project exists to get behind. In developing the method it
reached for "guidance" for رشد, "desert dwellers" for أعراب and "road" for
صراط — each corrected by the text only because someone pushed back. That loop is
the quality control, and it cannot be removed without the output becoming one
model's reading with a citation apparatus attached.

## Part 4 — Standing questions

**The MT boundary.** `CLAUDE.md` rule 7 states machine translation never touches
Quranic text. This method automates *evidence gathering*, while a human authors
every cluster decision. That is arguably not MT — but the distinction must be
written into `CLAUDE.md` explicitly before a pipeline exists, not defended
afterwards.

**Roots not yet done.** Large, high-frequency roots need a dedicated pass before
they appear in any rendering. `ك ف ر` is the first of these; it was used in the 9:97
draft as a conventional choice, which by Rule 1 it should not have been.

**Where authority sits.** This method produces evidence-constrained renderings, not
authoritative ones. Nothing here entitles the output to be treated as a settled
reading of scripture, and the site must not present it as one.

---

## Appendix — Checklist per word

1. Derive the root with an interposing-letter search. Re-run any empty result. (R2)
2. List every form sharing the skeleton; separate colliding roots. (R5)
3. Group all occurrences by frame. (R4)
4. Look for a self-gloss or purpose clause. (R6)
5. Look for same-sentence contrast. (R7)
6. Check the subject — is Allah among them? (R8)
7. Search whether another Arabic word already owns your candidate English word. (R9)
8. Check for a cognate accusative. (R10)
9. Read three verses either side. (R12)
10. Assign a grade. If Undetermined, stop and say so. (R3, R11)
11. Record the query and the token ids. (R17)
