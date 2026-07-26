# Security policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through GitHub's private vulnerability reporting: go to the
**Security** tab of this repository and choose **Report a vulnerability**. That
opens a channel visible only to the maintainer.

If you cannot use GitHub, say so in a public issue *without any detail* — just
"I would like to report a security issue privately" — and a contact will be
arranged.

You will get an acknowledgement within 7 days. This is a small project with one
maintainer, so please allow reasonable time for a fix before disclosing publicly.
Coordinated disclosure is welcome and credit will be given unless you ask
otherwise.

## What is in scope

- The web application at `quranbench.com`
- The public API under `/api/v1`
- The corpus build pipeline (`packages/corpus-build`)
- Anything that could **alter, misattribute or fabricate Quranic text** — see below

## Corpus integrity is a security concern here

Most sites treat content tampering as a data problem. For this project it is the
central one. The whole proposition is that the Arabic text is unmodified and that
every derived field is traceable to a named source. So the following are treated
as security issues, not merely bugs:

- Any way to make the site display Quranic text that differs from the Tanzil
  source edition
- Any way to make human-written or computed content render without its provenance
  tag, or in a way that visually resembles scripture
- Any way to make a published corpus artifact differ from its recorded sha256
  while still verifying
- Any way to make a search result or an investigation misreport the query or the
  corpus version that produced it

Every corpus artifact is checksummed and the manifest is public, so you can verify
integrity yourself:

```bash
curl -O https://quranbench.com/api/v1/download/0.8.0/quranbench-corpus-v0.8.0.tar.gz
curl -O https://quranbench.com/api/v1/download/0.8.0/quranbench-corpus-v0.8.0.tar.gz.sha256
shasum -a 256 -c quranbench-corpus-v0.8.0.tar.gz.sha256
```

If that check ever fails against a freshly downloaded pair, report it.

## Out of scope

- Missing security headers already documented as known gaps, unless you can
  demonstrate exploitation
- Rate limiting on public read endpoints — it is a courtesy backstop and is
  documented as per-process, not global
- Reports produced solely by an automated scanner with no demonstrated impact
- Social engineering, physical attacks, and denial of service through sheer volume

## Known and accepted

Disclosed rather than hidden, because pretending otherwise would be worse:

- **The Content-Security-Policy allows inline script.** Next.js serves its
  hydration payload as inline `<script>`, and a nonce-based policy would force
  every page out of static rendering. External script is blocked; inline is not.
- **The public read API's rate limit is enforced per process,** not across
  replicas.
- **Session cookies are `SameSite=lax`** with a double-submit CSRF token on every
  enumerated state-changing route.
