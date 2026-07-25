## Batch 3 and 4 — trust surfaces and research tools (workplan items 8–15)

Read `CLAUDE.md`, `docs/architecture.md`, `docs/design-system.md` and `docs/extensibility.md` first. Batches 1–2 are complete; corpus is v0.8.0 with glosses, transliteration and Lane's Lexicon.

## Batch 3 — trust surfaces

These are currently missing entirely, and on a site whose pitch is trust and correction their absence is conspicuous.

### 8. About page — `/about`

What this is, why it exists, what it claims and does not claim, who runs it, how it is funded, and the editorial policy. Written for a sceptical first-time visitor.

The owner has not yet decided whether to use his real name. **Structure the page so the identity is a single clearly-marked placeholder** (`SITE_OWNER_NAME` in one config file) that he fills in — do not invent a name, and do not leave the section out. Everything else on the page should be complete and final.

### 9. Report a correction

A route reachable from every verse, word, root and investigation page.

- Captures: what page, what is wrong, what it should be, optional contact.
- Writes to the existing `ModerationReport` queue.
- Rate limited. Works without an account. Works with JS disabled.
- After submitting, tell the user what happens next honestly — including that corrections to Quranic text itself are impossible by design and such reports concern annotations, translations or editorial content.

A platform that promises to be corrected must have somewhere to be told.

### 10. Contact and colophon — `/colophon`

Every source, licence, tool and credit in one place. Thanks to Tanzil, Leeds/Kais Dukes, the translators, Lane, the Amiri authors. Cheap to build; it signals seriousness and it is the page other researchers look for.

## Batch 4 — research tools

### 11. Reverse lookup — `/gloss/[word]`

Given an English gloss, show every Arabic token rendered that way, grouped by root and lemma, with counts. And the inverse: given a token, which other Arabic words share its gloss.

This is the original brief's "detect when different Arabic words are translated identically". Present it as computation, not argument — counts and links, no editorial framing. Server-rendered, crawlable, permalinked, in the sitemap.

### 12. Similar verses

On each verse page: the verses most similar to it, ranked by shared roots. Define the similarity measure explicitly (consider Jaccard over root sets, with common roots like أ ل ه down-weighted or a documented stoplist — justify your choice). Document the method on `/method`. Show the score.

Precompute at build if per-request cost exceeds budget. Report the approach and timings.

### 13. Root co-occurrence

On each root page: which other roots most often appear near this one, within a stated window. State the window and the measure on the page. The original brief called this "connected concepts".

### 14. Keyboard navigation

Already specified in the design system, not built. Arrow keys move between tokens, Enter opens the word page, `/` focuses search, Esc closes any panel. Visible focus states throughout. Announce token changes to screen readers politely.

### 15. Random word — `/random`

Redirects to a random word page. Deterministic when given a seed, for testing.

## Tests

- `/about` renders with the owner-name placeholder clearly marked and no invented identity
- Correction form submits without an account and without JS, writes a `ModerationReport`, and is rate limited
- `/colophon` lists every source in `sources.json` — assert nothing is missing by comparing against the manifest
- Reverse lookup returns expected groupings for a hand-checked gloss
- Similar verses: a hand-picked pair known to share roots ranks highly; an unrelated verse does not
- Co-occurrence returns stable, documented results
- Keyboard navigation works end-to-end in Playwright
- `/random` resolves to a valid word page; seeded runs are deterministic
- No-JS and axe on every new page
- Full suite green

## Report back

For each research tool: the measure chosen and why, and one worked example showing it produces a sensible result. Plus anything on `/about` you could not complete without the owner's decisions.
