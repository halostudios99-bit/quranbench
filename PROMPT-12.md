# Prompt 12 — fonts, auth flow, benchmark fixes

Read `CLAUDE.md`, `docs/design-system.md` and `docs/architecture.md` first.

## Part A — Arabic fonts

The site currently renders Arabic in a system fallback. The loading mechanism exists; the font files do not.

**Decision: use Amiri and Amiri Quran (SIL Open Font License), not KFGQPC.** OFL permits redistribution; KFGQPC's licence does not, and this project ships a downloadable dataset and must be licence-consistent throughout. Update `docs/design-system.md` §1 to record this decision and why.

- Fetch Amiri and Amiri Quran woff2 from an OFL-licensed source. Self-host in `public/fonts`. No runtime Google Fonts request.
- Include the OFL licence text alongside the fonts and credit in `docs/licensing.md`.
- Subset to the Arabic ranges actually used — Arabic, Arabic Supplement, Arabic Extended-A, Arabic Presentation Forms. Report before and after sizes.
- `font-display: optional` for Quranic text, preloaded on routes whose LCP element is Arabic.
- Verify the design system's typography rules now hold with a real font: line-height ≥ 2.0 with tashkeel not clipping, no letter-spacing, no justification, diacritics rendering correctly at reading and word-page sizes.

Report LCP before and after on a verse page and a surah page.

## Part B — authentication flow

The data layer has accounts, sessions and contributor-terms enforcement. There is no way to sign in.

- `/signup`, `/signin`, `/signout`, `/verify/[token]`, `/account`
- Email + password (argon2 or bcrypt), stable public handle chosen at signup, real name optional
- Contributor terms shown in full at signup with explicit acceptance, recorded with version and timestamp — the data layer already requires this
- Email verification required before publishing. **In development, write the verification link to the server console** rather than integrating an email provider — that is a deployment decision, not a build one. Structure it behind a `Mailer` interface with a console implementation so a real provider drops in later.
- Sessions: httpOnly, secure, sameSite=lax, rotation on privilege change
- Rate limits already defined in `domain/config.ts`
- Signed-in state in the header; `/account` shows handle, email, verification status, contributor-terms acceptance, and the user's investigations

Everything a signed-out visitor can see must stay visible without an account. Nothing moves behind the login.

## Part C — benchmark failures

`pnpm test` currently fails:

```
scoped: 1.265ms >= budget 1ms
pos:   12.478ms >= budget 10ms
```

Fix the implementations rather than raising the budgets. `pos:N` matches 27,450 tokens — materialising that many ids is the likely cost. Consider returning results lazily or paginating at the engine level, but do not change what a result means.

If a budget is genuinely unachievable, say so with measurements and reasoning rather than quietly loosening it.

## Part D — housekeeping

- Wire the e2e suite into a `pnpm test:all` script; keep `pnpm test` fast
- Delete corpus v0.4.0 and v0.5.0 from `out/` now that v0.6.0 is current, keeping the mapping chain intact
- A full-dataset tarball per version on `/data`, generated at build, with its own checksum

## Tests

- Fonts load and are self-hosted — assert no external font requests
- A signed-out user can reach every public page
- A user cannot publish before email verification
- Contributor terms acceptance is recorded at signup with version
- Session cookie attributes are correct
- All benchmarks pass
- e2e still green

## Report back

Font sizes before and after subsetting, LCP before and after, how you fixed each benchmark, and anything in Part B that is not production-ready.
