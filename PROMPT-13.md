# Prompt 13 — audit the existing articles, seed investigations, final review

Read `CLAUDE.md`, `docs/architecture.md` and `docs/extensibility.md` first.

## Context

The project owner has 18 articles written between 2017 and 2020, exported as markdown to `../quranandfaith-export/` (one directory up from the repo root). They are the seed content for Investigations.

They were written without tooling. At least one known error exists: `zakat.md` states the root of zakat is `زَكَّىٰ`, which is a Form II verb, not a root — the root is `ز ك و`. There are likely more.

A platform whose promise is reproducibility cannot republish unverified linguistic claims. Audit before seeding.

## Part A — audit tool

Build `packages/audit` — a reusable checker, not a one-off script.

For a given markdown file, extract and verify against the corpus:

- **Verse references** (`2:43`, `Quran 2:43`, `Al-Baqarah 2:43`) — does the reference resolve? Does any quoted Arabic beside it actually match that verse?
- **Quoted Arabic** — does this string appear in the corpus? Match under canonical equivalence and under normalisation, reporting which. Flag anything that appears nowhere.
- **Root claims** — sentences asserting a root (`the root word for X is Y`). Check the claimed root against the corpus morphology for the word in question. This is what catches the zakat error.
- **Transliterations** paired with Arabic — flag mismatches where checkable.

Output a machine-readable report plus a readable markdown summary per article: what verified, what did not, and what could not be checked automatically. **Never auto-correct.** Flag for human decision.

Be conservative. A false positive costs the owner five minutes; a false negative republishes an error.

## Part B — run it

Run the audit over all 18 articles. Write the reports to `audit-reports/` in the repo. Commit them.

Produce one summary document ranking articles by how much verification work they need, with every flagged claim listed and its location.

## Part C — seed as drafts

For each article, create an Investigation in **draft** status, authored by a seed account:

- Claim: extracted from the title and opening where possible, otherwise left empty and flagged for the owner
- Body: the article prose, preserved
- Evidence: every verse reference that verified, pinned by token id
- Query: left empty — the owner must supply a reproducible query before publishing, and the publish gate already enforces this
- Counter-evidence: empty, flagged — the gate enforces this too
- An `audit` annotation listing every flagged claim, visible to the author

**Nothing is published.** Every one is a draft requiring the owner's review. The publish gate is what makes this safe: an article cannot go live until it has a claim, a working query, and counter-evidence.

Write a seeding script that is idempotent and clearly separated from production code.

## Part D — final review

Then review the whole project as a critical outside engineer:

- Run every test suite; report the true state, including anything skipped or flaky
- Verify the five-part infrastructure test in `docs/extensibility.md` §9 still passes
- Check the `CLAUDE.md` non-negotiable rules are actually upheld in code — especially that no machine translation can reach Quranic text, nothing is gated behind login or payment, and every public page renders without JavaScript
- Check for dead code, unused dependencies, TODOs, and any place a spec was quietly not met
- Confirm licences are correctly attributed everywhere and that the GPL boundary is intact

Write `docs/state-of-the-project.md`: what is built, what is not, what is fragile, what should be done next in what order, and what an outside reviewer would criticise first. Write it honestly — it is for the owner, not for marketing.

## Report back

Audit findings: how many claims checked, how many flagged, and the worst offenders. Then the final review: what is genuinely finished, what is not, and the single most important thing to fix next.
