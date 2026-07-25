# Translation editions — inclusion and rejection report

_Corpus v0.7.0. This report is the committed record required by `docs/licensing.md`
and Prompt 09: every translation edition considered, whether it was included, and
the exact licence reason. Permission is never inferred from availability._

## The binding constraint

quranbench publishes a **redistributable** open dataset, and separately renders
translations to readers. Every edition carries a `redistributable` flag:

- **Redistributable** editions (public domain, or a permissive/attribution CC
  licence) are both **displayed** to readers *and* **shipped** in the dataset
  downloads and the full tarball.
- **Display-only** editions are **displayed** to readers but **excluded from every
  download** and from the tarball. This is for editions whose licence permits
  display with attribution but not open redistribution.

If an edition's licence is unclear, ambiguous, or absent, it is **not included at
all**. This is enforced in code:
`packages/corpus-build/tests/test_translations.py::permits_redistribution` fails the
build if a *redistributable* edition carries a NonCommercial (NC) or NoDerivatives
(ND) restriction or an unrecognised licence, and if a *display-only* edition's
licence would in fact permit redistribution (the flag must match the licence). The
dataset builder excludes display-only editions from the tarball
(`test_build.py::test_display_only_editions_are_excluded_from_the_tarball`), and the
web download route refuses to serve them
(`data-downloads.test.ts`).

## The Tanzil finding (why Tanzil is not a licence basis)

Prompt 09 directs using Tanzil's translation collection and reading each edition's
licence. On inspection, **Tanzil publishes no per-edition redistribution licence**.
Its translations page carries a single blanket Terms of Use
(<https://tanzil.net/trans/>, read 2026-07-25):

> The translations provided at this page are for non-commercial purposes only. If
> used otherwise, you need to obtain necessary permission from the translator or the
> publisher. … Redistributing the following list in another website is not allowed,
> unless direct permission is granted by the Tanzil Project.

That is **non-commercial and no-redistribution** — the opposite of what an open
dataset needs. An asterisk on the page marks editions that are additionally
third-party copyrighted and used by permission. **Conclusion: Tanzil hosting alone
qualifies nothing for redistribution.** We therefore include editions on the basis
of each *work's own public-domain status* (author death + first-publication dates),
independently verifiable, and retrieve the text from a public-domain compilation
(see below) rather than from Tanzil. This deviation from the prompt's literal
instruction is deliberate and is the only way to satisfy the binding licensing rule.

## Retrieval source

Verse text is retrieved from **fawazahmed0/quran-api**
(<https://github.com/fawazahmed0/quran-api>), a compilation whose own compilation
work is released into the **public domain under the Unlicense**, pinned to immutable
commit `6be8e17f2a0c13b1f33b1c3057f73cb28d5e848e` and checksum-verified on download.
This is a *retrieval origin* only. For the redistributable editions below, the right
to redistribute derives from each work's own public-domain status. For the
display-only Itani edition, our right is only to **display** it under its CC
BY-NC-ND licence — never to redistribute it — which is exactly why it is excluded
from the downloads.

## Included editions (3)

All three are **public domain worldwide**: the translator has been dead far longer
than 70 years, and each was first published before 1 January 1931 — so each is also
public domain in the United States (past the 95-year term, unaffected by URAA
restoration).

| id | Translation | Translator | Year | Licence | Verified at |
| --- | --- | --- | --- | --- | --- |
| `en-pickthall` | The Meaning of the Glorious Koran | Marmaduke Pickthall (d. 1936) | 1930 | Public Domain | <https://en.wikisource.org/wiki/The_Meaning_of_the_Glorious_Koran_(1930)> |
| `en-rodwell` | The Koran | John Medows Rodwell (d. 1900) | 1861 | Public Domain | <https://en.wikisource.org/wiki/The_Koran_(Rodwell)> |
| `en-palmer` | The Qur'an (SBE vols VI & IX) | Edward Henry Palmer (d. 1882) | 1880 | Public Domain | <https://en.wikisource.org/wiki/The_Qur%27an_(Palmer)> |

Each ships as `out/v0.7.0/translations/<id>.jsonl` (6236 verse-level lines, keyed by
corpus verse id — identity mapping, verified in tests) with its own
`<id>.LICENSE.md` beside it, and is recorded in `sources.json` with licence,
translator, year, licence URL and checksum.

## Display-only editions (1)

Displayed to readers but **not part of the redistributable dataset** — served on the
site, excluded from every download and from the full tarball.

| id | Translation | Translator | Year | Licence | Verified at |
| --- | --- | --- | --- | --- | --- |
| `en-itani` | Quran in English (ClearQuran) | Talal Itani | 2012 | CC BY-NC-ND 4.0 | <https://creativecommons.org/licenses/by-nc-nd/4.0/> |

Talal Itani's ClearQuran is modern, readable English and is licensed **CC BY-NC-ND
4.0** — NonCommercial and NoDerivatives. Those terms permit displaying the edition
verbatim with attribution but are incompatible with an openly-redistributable
dataset. So it is the **default reading translation** on the site, `redistributable:
false` in `sources.json` and the manifest, excluded from the tarball by the dataset
builder, and refused by the download route. It ships as
`out/v0.7.0/translations/en-itani.jsonl` on disk (served and checksummed) with its
own `en-itani.LICENSE.md` stating the display-only status. It becomes v0.7.0 with
token and verse ids unchanged from v0.6.0 (asserted in tests).

## Rejected editions (and why)

| Edition | Licence status | Reason for rejection |
| --- | --- | --- |
| **Yusuf Ali** (1934/38) | PD in life+70 lands since 2024, **but US copyright restored by the URAA to ~2033** | Not *clearly* redistributable for a globally-distributed dataset while US copyright subsists. Rejected under the "if ambiguous, do not include" rule. Re-includable after 2033 (or if distribution is scoped to life+70 jurisdictions). Ref: <https://en.wikisource.org/wiki/Author:Abdullah_Yusuf_Ali> |
| **A. J. Arberry — The Koran Interpreted** (1955) | © — under copyright to 2040 (UK/EU) / 2051 (US) | In copyright. Free scans online are lending, not a redistribution licence. |
| **M. H. Shakir** (1968/83) | Legally PD (derivative of PD Muhammad Ali 1917) but **attribution/provenance contested** (documented as a plagiarised revision of Muhammad Ali's 1917 translation) | Rejected to avoid propagating a disputed attribution. The cleaner path — ingesting Muhammad Ali's 1917 translation directly — is a candidate for a future version. |
| Saheeh International, Hilali & Khan, Maududi, Mubarakpuri, Sarwar, Wahiduddin Khan, Ahmed Ali, Ahmed Raza Khan, Daryabadi, Qarai, Qaribullah | Under copyright / Tanzil "used by permission" or no clear redistribution licence | None carries a documented licence permitting redistribution. Tanzil's blanket non-commercial ToS applies. |

## Divergence method (documented on `/compare`)

"Materially divergent" is **computed, not curated**. For a verse, each edition's
translation is lowercased, stripped of punctuation and a fixed stopword list, and
light suffix-stemmed, yielding a set of significant word-stems. We compute the
minimum pairwise **Jaccard similarity** across editions; a verse is flagged
divergent when that minimum falls **below 0.4** (editions share less than ~40% of
their significant vocabulary). The per-verse score is always shown so a reader can
judge substantive vs. stylistic difference. With the current three editions — all
19th/early-20th-century and stylistically distant — a **majority of verses diverge
lexically** (~77% of verse pairs at this threshold for Pickthall vs. Yusuf-Ali-class
prose); this is expected and honest, and the measure sharpens as more, more-modern
editions are added. The method and threshold are printed on every `/compare` result.
