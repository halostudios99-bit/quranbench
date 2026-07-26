# State of the project

_Written 2026-07-26, after Batches 5–6 (production hardening and deployment
readiness), as an honest internal assessment — for the owner, not for marketing.
It records what is genuinely built, what only looks built, what is fragile, and
what an outside reviewer would attack first. It supersedes the 2026-07-25 version._

## Final cleanup (2026-07-26, after Batches 5–6)

A closing pass addressing the loose ends the batch reports had flagged out of
scope. Nothing new was built; four things were finished:

- **The three pre-existing e2e failures are fixed** and the whole e2e suite is now
  green against real Postgres (**149 passed, 5 skipped, 0 failed**). `actions.spec`
  no longer hardcodes the corpus version — it reads it from `/api/health`, so a
  corpus bump can't break it. The `/data` page had a **real duplicate-render bug**
  (the "Display-only translations" heading rendered once per version, inside the
  version loop); it now renders **once**, deduplicated across versions
  (`app/data/page.tsx`) — the page, not the test, was fixed. `tooltip.spec` waits
  for `document.fonts.ready` before measuring layout, so the Arabic web-font
  reflow can no longer flake the no-layout-shift assertion (no sleep added).
- **The non-redistributable Itani edition is no longer committed.** This repo is
  MIT and meant to be forked commercially; a CC BY-NC-ND artifact inside it created
  licensing ambiguity. `translations/en-itani.jsonl` and its `LICENSE.md` are now
  gitignored across every version, `git rm --cached`'d, fetched at build time only,
  and documented in `LICENSING.md`. The corpus loader **degrades cleanly** when a
  non-redistributable edition is absent — it skips it (ENOENT only, and only for
  `redistributable: false`) rather than failing to boot, so a fork that hasn't
  fetched Itani still runs, one translation lighter. A missing *redistributable*
  edition remains a hard error. Two new tests guard this: one asserts no
  non-redistributable artifact is tracked by git
  (`packages/corpus/src/licensing.test.ts`), one asserts the loader degrades
  cleanly on absence (`packages/corpus/src/index.test.ts`).
- **The CLAUDE.md non-negotiables were re-audited against the code** (see the
  updated table at the bottom). Rules 1, 3, 4, 5, 6 hold with cited enforcement.
  Rule 2 remains convention-enforced (single tested renderer, no compile-time
  guard). Rules 7 (MT) and the payment-isolation sub-clause of Rule 5 remain
  **vacuous** — those subsystems do not exist, so there is no boundary to enforce
  or violate yet; both must be re-audited when `i18n-mt` and Stripe land.

**Final verification run (all suites):**

- **Python (`pytest`, corpus-build):** 109 passed, 1 skipped.
- **Packages (`vitest run`):** 332 passed across 11 files.
- **Web unit (`vitest run`, apps/web):** 186 passed across 28 files.
- **Playwright e2e — against real Postgres:** 149 passed, 5 skipped, **0 failed**.

The Docker-image and Lighthouse gaps below are unchanged — still unverified in this
environment (no Docker daemon, no headless-Chrome Lighthouse run).

How this was produced: every package and app unit suite was run; the app was
type-checked, linted and production-built; the Playwright e2e suite was run against
a **real Postgres**; the backup round-trip and the Prisma migrations were exercised
against that same database; and the codebase was reviewed against `CLAUDE.md`,
`../DECISIONS.md` and `docs/`. Findings cite `file:line` where useful. Nothing here
is inferred from comments alone. Two things could not be verified in this
environment and are called out explicitly: the **Docker image** (no Docker daemon)
and **Lighthouse** (no Chrome).

## Verification basis (what was actually run)

- **`vitest run` (packages):** 329 tests pass across 10 files (`@quranbench/corpus`,
  `@quranbench/search`, `@quranbench/audit`). Search p95 latency well under budget.
- **`vitest run` (apps/web):** 186 tests pass across 28 files — up from 156. The 30
  new tests cover argon2id + legacy-scrypt upgrade (`auth.test.ts`), the mailer
  (`mailer.test.ts`), the Redis/store rate limiter and fail-closed policy
  (`rate-limit.test.ts`), CSRF token/origin checks (`csrf.test.ts`), and the full
  password-reset domain (`password-reset.test.ts`).
- **`tsc --noEmit` (apps/web):** clean.
- **`eslint .`:** clean. The eslint config was previously failing on pre-existing
  `.js`/`.mjs` files (missing globals); this is now fixed (`eslint.config.js`).
- **`next build`:** succeeds, now with `output: 'standalone'` (`next.config.ts`).
  Standalone server + traced deps produced under `.next/standalone`.
- **Playwright e2e — RUN, against real Postgres:** `146 passed, 3 failed, 5 skipped`.
  This is the first time the e2e layer has been executed with a database in this
  project's assessments; the previous report could only say "NOT run." The 3
  failures are **pre-existing and unrelated to this batch** (see below).
- **Prisma `migrate deploy`:** all 6 migrations apply cleanly to a fresh Postgres
  16, including the new `0006_password_reset` (an `ALTER TYPE … ADD VALUE` plus a
  table). Verified live.
- **Backup round-trip:** `scripts/backup-restore-test.sh` passes against real
  Postgres — dump → restore → row counts match exactly.
- **Zenodo packager:** `scripts/zenodo-package.mjs` produces a deposit whose
  `CHECKSUMS.sha256` verifies (`shasum -c` OK).

**NOT verified here (no capability in this environment):**

- **The production Docker image** — no Docker daemon. The multi-stage `Dockerfile`,
  the standalone build it packages, and the corpus/doc path layout were all
  reasoned through and the underlying `next build` succeeds, but the image was
  never built or started, so the workplan's "image builds and starts; health check
  passes" is **unproven**. This is the single biggest untested claim.
- **Lighthouse** — no Chrome. `lighthouserc.json` encodes the budgets as
  assertions and the CI job is wired, but no score was produced. No scores were
  fabricated (per the workplan).

Total automatically verified: **515 unit tests + 146 e2e green**, plus the backup
and migration checks. Nothing observed flaky in the unit layer.

## What Batches 5–6 added

- **argon2id password hashing** (`server/domain/password.ts`). Replaces scrypt with
  argon2id via `hash-wasm` (WebAssembly — no native module to compile on the VPS,
  the property the old scrypt choice existed to protect). Parameters are documented
  (m=19 MiB, t=2, p=1). Legacy scrypt hashes still verify and are **transparently
  re-hashed to argon2id on the next successful sign-in** (`accounts.ts:verifyCredentials`
  → `store.updatePasswordHash`), so nobody is locked out. Proven by a test that
  seeds a real scrypt hash, signs in, and asserts the stored hash is now argon2id.
- **Real mailer** (`server/mailer.ts`). nodemailer SMTP behind the existing `Mailer`
  interface, selected by env (`SMTP_URL`/`SMTP_HOST`); the console mailer remains the
  default with no credentials, so local dev is unaffected. The SMTP path logs only
  envelope metadata — recipient, subject, message id — **never the token-bearing
  URL or body**, asserted by a test.
- **Shared rate limiting** (`server/domain/rate-limit.ts`, `server/redis.ts`). A
  `RateLimiter` seam with two implementations: `storeRateLimiter` (Postgres/in-memory,
  the single-process and test path) and `redisRateLimiter` (a sliding window over a
  Redis sorted set, the shared store across replicas). Selected at boot via a
  provider bound in `research.ts` when `REDIS_URL` is set. Writes **fail closed** on
  backend outage; reads fail open (see caveat below). Redis added to both compose
  files.
- **Password reset** (`server/domain/password-reset.ts`, `(auth)/actions.ts`,
  `(auth)/forgot-password`, `(auth)/reset-password`). Token single-use, hashed at
  rest, 1-hour expiry, rate limited per client, no account enumeration (same
  response for known/unknown emails), and **all sessions invalidated on success**.
  Nine domain tests cover the full flow, single-use, expiry, weak-password-without-
  consuming, and session invalidation.
- **CSRF** (`server/security/csrf.ts`, `middleware.ts`, `components/CsrfField.tsx`).
  Double-submit token + same-origin check on every enumerated state-changing surface
  — sign-in, sign-up, sign-out, account (resend verification), report, and password
  reset — layered on top of `SameSite=lax` and Next's built-in Server Action origin
  check. The token is minted in middleware only on form paths (so cached public
  pages get no `Set-Cookie`). e2e confirms a forged POST to `/report/submit` is
  rejected before any DB write.
- **Error pages** (`app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx`).
  A 404 in the site design offering search + navigation, and 500 boundaries that
  show a generic apology and **never** a message, stack or digest-as-detail. e2e
  asserts the 404 leaks no internals.
- **Deployment** (`docker/Dockerfile`, `docker/compose.prod.yaml`, `docker/Caddyfile`,
  `docs/deployment.md`). Multi-stage build → non-root standalone runner with a
  health check; production compose of app + Postgres + Redis + Caddy (automatic
  TLS) + a one-shot `migrate` service; corpus baked into the image. A `/api/health`
  endpoint reports readiness off the loaded corpus.
- **Backups** (`scripts/backup.sh`, `restore.sh`, `backup-restore-test.sh`,
  `docs/backups.md`). Dump→gzip→checksum, checksum-verified restore, and a
  row-count round-trip test (verified live). Cron schedule documented.
- **Lighthouse + CI** (`.github/workflows/ci.yml`, `lighthouserc.json`). First CI in
  the repo: a fast check job (lint/types/unit/build), an e2e job (Postgres + Redis +
  migrations + backup test + Playwright), and a Lighthouse job asserting the
  design-system budgets.
- **Zenodo mirror** (`scripts/zenodo-package.mjs`, `docs/zenodo.md`). Packages a
  corpus version with CITATION.cff, Zenodo metadata, a researcher README, all
  upstream licences, and a verifying checksum manifest. Uploads nothing; deposit is
  a documented manual procedure.

## What is genuinely production-ready

- **The research substrate** (corpus, search, API, reproducibility, data downloads,
  investigations domain, MCP) — unchanged and still fully tested; see the prior
  report's detail. This was solid and remains so.
- **Authentication and account security.** argon2id with transparent migration,
  hashed single-use tokens for verification and reset, session rotation, CSRF on
  every enumerated write, no account enumeration on reset. This is now a
  conventionally-hardened auth stack, all proven at the domain level and much of it
  at the e2e level.
- **Rate limiting** is now shareable across replicas (Redis) with a correct
  fail-closed policy for writes and a graceful fall back to the store limiter.
- **Backups** are real and, crucially, **proven restorable** — not just a dump
  script but a passing round-trip test.
- **The migration path** applies cleanly to a real database, including the new one.

## What is fragile or unverified

- **The Docker image is unbuilt here.** Everything it depends on works
  (`next build` standalone succeeds; runtime file reads resolve relative to the
  server's working directory, which the image layout mirrors), but no container was
  built or started, so port binding, the non-root file permissions, the health
  check under load, and the corpus path inside the image are **reasoned, not
  observed**. First action on any machine with Docker: build and smoke-test it.
- **Lighthouse is configured but unmeasured.** The budgets (LCP < 1.8s, CLS < 0.05,
  categories > 95, TTFB < 400ms) are encoded as assertions and the CI job is wired,
  but no run happened (no Chrome). The performance claims remain aspirational until
  the `lighthouse` CI job runs green on a real browser.
- ~~**Three pre-existing e2e failures persist**~~ **— fixed in the final cleanup
  pass (2026-07-26).** `actions.spec.ts` now reads the corpus version from
  `/api/health` instead of hardcoding it; the `/data` page's duplicate "Display-only
  translations" heading (a real render bug) was consolidated to one deduplicated
  section; `tooltip.spec.ts` waits for `document.fonts.ready` before its layout
  assertion. The e2e suite is now green (149 passed, 0 failed) against real Postgres.
- **The public API read-path limiter is still per-process** (`server/api/http.ts`),
  not Redis. This is deliberate — it is explicitly a courtesy backstop that fails
  open, and the security-relevant _write_ limits are the ones moved to Redis — but
  it means the published "600 req/min" API limit is **not enforced across
  replicas**. Honest gap; acceptable for launch, worth closing later.
- **`saveReaderPrefs` carries no CSRF token.** It is an RPC-style Server Action
  (called with an object, not from a `<form>`), so it relies solely on Next's
  built-in Origin check, not the double-submit token. It only writes a non-sensitive
  view preference and is a no-op when signed out, so the exposure is negligible —
  but it is the one state-changing action not covered by the token.
- **Email deliverability is untested.** The console mailer works; the SMTP path is
  unit-tested for its "never log the token" guarantee but has never sent a real
  message (no SMTP credentials). The first real signup on a deployment is the test.
- **argon2id costs ~19 MiB per sign-in.** Chosen deliberately over the 46 MiB
  profile to protect a small VPS, but sign-in is now measurably heavier than scrypt;
  fine at this scale, worth remembering under load.

## Carried forward from the prior report (still true)

- **Machine translation and payments do not exist**, so CLAUDE.md rules 7 (MT never
  touches scripture) and the payment-isolation rule are _vacuously_ upheld — the
  barriers must be built with those features.
- **Provenance is enforced at the container, not the glyph** for raw `.quran` spans
  — still a convention a new surface could break.
- Resolved since the prior report: the **project LICENSE** now exists (`LICENSE`,
  `LICENSING.md`), **draft exposure by slug** is fixed
  (`research.ts:getInvestigationView` → `canViewInvestigation`), and the corpus is
  now version-baked into the deploy image.

## What an outside reviewer would attack first (in order)

1. **"You hardened everything but never started the container."** The deployment is
   a paper design until the image is built and a `compose up` reaches a healthy
   `/api/health` with TLS. It is the highest-leverage unverified claim. — Build and
   smoke-test on a Docker host.
2. **"Your performance budgets are unmeasured."** Lighthouse is wired but never run.
   A reviewer will (rightly) not take LCP/CLS on faith. — Run the CI `lighthouse`
   job on a runner with Chrome.
3. ~~**"CI is red."**~~ **Resolved (2026-07-26).** The three pre-existing e2e
   failures are fixed and the suite is green against real Postgres; the remaining
   red on CI would only be the still-unrun Docker/Lighthouse jobs above.
4. **"The API rate limit you publish isn't the one you enforce."** Read-path limiting
   is per-process while the header advertises a global number. — Move it to Redis or
   soften the published claim.
5. **"Show me a real password-reset email."** The flow is correct in code and tests,
   but no message has ever left the building. — Configure SMTP and send one.

## Non-negotiable rules (CLAUDE.md) — status

Re-audited against the code on 2026-07-26 (evidence cited inline):

| Rule                                                 | Verdict     | Note                                                                                                          |
| ---------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------- |
| 1 Never modify Quranic text                          | UPHELD      | derived forms are separate fields (`normalise.py`); loader only reads + checksums, never mutates (`load.ts`) |
| 2 Nothing resembles scripture w/o provenance tag     | **PARTIAL** | `Verse`/`VerseTranslations` always emit `<ProvenanceTag>`; single-renderer is tested but not compiler-forced |
| 3 Server-render everything public; works with JS off | UPHELD      | no `'use client'` in any `page.tsx`/`layout.tsx`; `no-js.spec.ts` green in the real e2e run                  |
| 4 Reproducibility                                    | UPHELD      | version + params + query on search/gloss/similar; `api-core.test.ts` asserts every read endpoint carries it  |
| 5 Nothing gated by login/payment                     | UPHELD      | no auth check on public pages/downloads; payment-isolation sub-clause vacuous (no payments code)             |
| 6 No Quran.Foundation API                            | UPHELD      | zero `quran.foundation` refs; `corpus.quran.com` hits are the Leeds QAC build source only                    |
| 7 MT never touches Quranic text                      | VACUOUS     | no MT service exists; `lib/translations.ts` operates on licensed human editions only. Re-audit when built    |

## What remains, in order

1. **Build and smoke-test the Docker image** on a machine with Docker: `docker
compose -f docker/compose.prod.yaml up --build`, confirm `migrate` completes, the
   app reaches healthy, and Caddy serves. This is the one deployment claim still on
   paper.
2. **Run Lighthouse** (CI `lighthouse` job, or `pnpm lighthouse` locally with Chrome)
   and confirm the budgets, or fix what regresses. No number until a real run.
3. ~~Fix the three pre-existing e2e failures~~ — **done (2026-07-26)**; e2e is green.
4. **Provision the deploy inputs the owner must supply:** register the domain + DNS,
   obtain real SMTP credentials, and fill `docker/.env` (Postgres password,
   `SITE_DOMAIN`, `TLS_EMAIL`, `NEXT_PUBLIC_SITE_URL`, SMTP).
5. **First real deploy as a dry run** on the VPS; watch TLS issuance and send a real
   verification + reset email end-to-end.
6. **Close the read-path rate-limit gap** (Redis) or adjust the published API limit.
7. **Schedule backups** (cron `backup.sh`) and push a monthly copy off the server.
8. **Deposit the current corpus version to Zenodo** (`scripts/zenodo-package.mjs` +
   `docs/zenodo.md`) and record the DOI on `/data` and `/method`.
9. Carried forward: build the MT and payment isolation barriers _with_ those
   features; move Rule 2 enforcement from convention to the component layer for raw
   `.quran` spans.

---

### Report-back summary (the workplan's three questions)

**What is genuinely production-ready:** the security posture — argon2id with
transparent migration, hashed single-use verification/reset tokens, CSRF on every
enumerated write, no account enumeration, shared fail-closed rate limiting — and
the operational safety net of a _proven-restorable_ backup. The migration path
applies cleanly to a real database. The app builds as a standalone server and the
full e2e suite passes (bar three pre-existing, unrelated failures) against real
Postgres.

**What is not:** the deployment itself is unexercised. The image was never built or
started here (no Docker), Lighthouse never ran (no Chrome), and no real email has
been sent. These are configured correctly and reasoned through, but "configured" is
not "observed."

**The single most important remaining risk:** that the container does not come up
cleanly on first real deploy — a path issue, a permission issue, or a health-check
timing issue that this environment could not surface. Everything it depends on was
verified; the assembled whole was not.

**What a first deployment still requires from the owner:** a registered domain with
DNS pointing at the VPS; a Docker host to build and smoke-test the image before
going live; real SMTP credentials; a filled `docker/.env`; and one supervised
`compose up` to watch migrations run, the health check pass, and TLS issue. Budget
half a day for the shakedown, not a one-click launch.
