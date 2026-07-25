# Internationalisation

Three separate translation systems. They must never blur into one another. Blurring them is the single most damaging mistake this project could make.

| Layer | Content | Method | Machine translation |
| --- | --- | --- | --- |
| 1. Interface | Buttons, labels, nav, errors | Human-translated string catalogues | Never |
| 2. Quran | Arabic text and its translations | Licensed human translation editions | **Never, under any circumstances** |
| 3. Editorial | Investigations, articles, method pages, community responses | Machine translation with disclosure, upgraded to human over time | Yes, with rules below |

---

## 1. The absolute rule

**Machine translation is never applied to Quranic text or to any Quran translation.**

If a reader selects Urdu and no licensed Urdu translation is available, the site shows the Arabic with the available translations clearly labelled by language — it does **not** machine-translate an English translation into Urdu. Doing so would produce a translation of a translation, displayed in the position where scripture is expected. For this project specifically that is unrecoverable.

Implementation: the Quran renderer has no access to the machine-translation service. Enforce this at the module boundary, not by convention.

Fallback when no edition exists for the selected language:

1. Arabic source, always
2. Any available licensed translations, each labelled with translator, edition and language
3. A plain notice: "No [language] translation is available yet under a licence we can use." Link to the translations status page.

Never silently fall back to English as though it were the reader's language.

---

## 2. Interface (layer 1)

- `next-intl` with per-locale message catalogues
- Human-translated. A machine-translated interface reads as cheap and undermines the premium goal.
- Launch with English and Arabic only. Add a language when a human translator is available, not before.
- Locale in the URL path: `/ur/...`, `/ar/...`. English at root.
- Language selector in the header, persisted to profile when signed in and to a cookie otherwise.

### RTL

Arabic, Urdu, Farsi, Hebrew, Pashto invert the entire interface, not just the text.

- `dir` set on `<html>` from locale
- Logical CSS properties throughout (already required by the design system)
- Icons with directional meaning (back, next, chevrons) mirror; icons without (search, settings) do not
- Numbers and Latin strings inside RTL text wrapped in `<bdi>`
- Every layout tested in both directions before it ships

---

## 3. Quran translations (layer 2)

- Each is a licensed edition, stored as a corpus artifact, versioned with the corpus
- Always displayed with translator name, edition, year, and licence
- Word-level alignment where available; verse-level otherwise
- A translations status page lists every language, what exists, what is licensed, and what is being sought

---

## 4. Editorial content (layer 3)

Investigations and articles are machine-translated on demand so a reader experiences the site natively in their language.

### Protected spans — mandatory

Editorial content is dense with Arabic, technical notation and citations. Machine translation will corrupt all of it unless explicitly prevented.

Never translate:

- Arabic text of any kind, quoted or inline
- Root notations (`ز ك و`)
- Token IDs (`quran:2:43:4`)
- Verse references (`2:43`, `Al-Baqarah 2:43`)
- Transliterated technical terms the author has chosen to keep (`salat`, `zakat`) — author-configurable per article
- Search query strings
- Proper nouns of surahs, translators and editions

Implementation: mark these spans with `translate="no"` and the equivalent no-translate markers in the MT provider's payload. Extract them to placeholders before sending, restore after. Test that a round-trip through the translation service returns Arabic byte-identical.

### Translation memory

- Store output in Postgres keyed on `(source_revision_hash, target_locale)`
- Re-translate only when the source revision changes — never per request
- This bounds cost, guarantees consistency, and makes translations correctable

### Human upgrade path

Every machine-translated block is editable by verified members who read that language. A corrected block is marked human-reviewed and never overwritten by machine output again.

This matters for two reasons: quality improves where readers actually are, and reviewed translations become indexable (see below). It also fits the platform's model — the community improves the work in public, with attribution.

### Disclosure

Machine-translated pages carry a persistent, non-dismissible banner at the top of the content, in the reader's language:

> This page was translated automatically and may contain errors. [Read the original in English.] [Suggest a correction.]

Not a footnote. Not a tooltip. Top of content, always visible. For a project whose entire premise is accuracy and verifiability, hiding the provenance of a translation would be self-defeating.

Blocks that have been human-reviewed show a quieter marker instead: "Translated by [name], reviewed [date]."

---

## 5. Search engine handling

This is where the trap is.

Google's spam policies treat pages created by automatically translating content **without human review or localisation** as scaled content abuse. Translating a small body of genuine original articles is not what the policy targets — but publishing 18 articles across 20 languages produces 360 indexable pages of unreviewed machine output, which is exactly the pattern that attracts a manual action. Given that being trusted by Google is an explicit project goal, be conservative.

**Rules**

- Machine-translated pages: `noindex, follow`. They serve readers, not crawlers.
- Human-reviewed translations: indexable, self-referencing canonical, included in the `hreflang` cluster.
- Never canonicalise a translation to the original — that removes it from the index entirely. Self-canonical plus `hreflang` alternates is correct.
- `hreflang` includes only indexable locales, with `x-default` on English.
- A locale graduates from `noindex` to indexed when its content is human-reviewed. Track review coverage per locale and flip automatically at a defined threshold.

The corpus pages — words, roots, verses — are unaffected. They are data, not prose, and their language-independent parts are indexable in every locale.

---

## 6. Provider

- Evaluate DeepL and Google Cloud Translation on the actual content, not on marketing claims. DeepL is generally stronger for European languages; coverage for Urdu, Pashto and Bengali needs checking against real article text containing Arabic.
- The provider sits behind an interface in `packages/i18n-mt/` so it can be swapped without touching application code.
- Priority languages, based on where readers are: Urdu, Indonesian, Bengali, Turkish, Arabic, French, Malay.

---

## 7. Header language selector

Single dropdown, one control, no separate switchers.

- Grouped: languages with full human interface first, then machine-translated
- Each entry shows its own endonym (اردو, not "Urdu")
- Indicates what the reader will get: "Interface and Quran translated" vs "Interface translated, articles machine-translated"
- Changing language preserves the current page and scroll position
- Never geo-detect and switch automatically. Suggest once, dismissibly, and respect the choice thereafter.
