# Prompt 07 — query parser fix, Next.js app, design foundation, reader

Paste everything below the line into Claude Code, in the `quranbench` folder.

---

Read `CLAUDE.md`, `docs/architecture.md` and **`docs/design-system.md`** first. `docs/design-system.md` is binding for every visual decision in this prompt — read it fully before writing any component. Corpus v0.5.0 is complete with morphology; `packages/corpus` and `packages/search` pass 292 TS and 74 Python tests.

## Part A — query parser defect

Found by independent review:

```
root:z-k-w        -> 59 hits    ok
root:زكو          -> 59 hits    ok
root:ز ك و        -> ERR unexpected token; expected end of query
root:"ز ك و"      -> ERR empty value for 'root:'
```

The engine accepts the spaced-Arabic root at the API level; the **string parser** cannot. Quoting — the obvious workaround — is also broken. The spaced form is the conventional way roots are written and is shown as a search chip in the design.

Note the deeper failure: `engine.test.ts` asserts string-level equivalence using only the *unspaced* form, so the suite passed while user-facing behaviour was broken. Fix the parser, then review the other string-level tests for the same shape of gap and strengthen them.

Required: `root:ز ك و`, `root:"ز ك و"`, `root:زكو`, `root:z-k-w` all return the same 59 results, and all compose correctly with `AND surah:2` (9 results). Quoted values must work for every field prefix, not just `root:`.

## Part B — Next.js application

Create `apps/web`. Next.js App Router, TypeScript strict, Tailwind. It imports `@quranbench/corpus` and `@quranbench/search`. No database, no auth, no payments in this prompt.

- Corpus loaded once at server start into a module-level singleton. Never per request.
- Every page in this prompt is server-rendered and must render its full content with JavaScript disabled. Verify this and say how you verified it.

## Part C — design foundation

Implement the design system as reusable primitives before building pages.

- CSS custom properties for all colour, both modes. Warm off-white light mode; warm near-black dark mode — never pure white or pure black. No hardcoded hex in any component.
- `next-themes` toggle, no flash on load.
- Self-hosted, subsetted Arabic fonts with `font-display: optional` and preload. Arabic never below 24px, `line-height` at least 2.0, no letter-spacing, no justification.
- Real RTL: `dir` on the element, logical CSS properties throughout.
- A `<ProvenanceTag>` primitive implementing the layer colours from the design system. Every rendered layer carries one.
- Mobile-first. Touch targets on Arabic tokens at least 44px.
- Motion only per the design system: `transform`/`opacity`, 120–300ms, `prefers-reduced-motion` respected. **No motion on Quranic text.**

## Part D — the one-renderer rule

Per `docs/architecture.md`, build these as the single renderers used everywhere:

- `<Verse>` — modes: reading, compact, evidence, result
- `<Token>` — the interactive Arabic word
- An action registry at `src/actions/registry.ts` as described in the architecture doc, with copy, share, permalink and cite implemented. Copy must offer the labelled variants and append the reference and source. Write both `text/plain` and `text/html`.

Do not duplicate verse or token markup anywhere. If a surface seems to need different markup, add a mode.

## Part E — the reader

- `/` — a homepage in the spirit of `homepage-mockup.html` in the parent folder: research search bar first, not a reading carousel. Look at that file.
- `/[surah]` — surah reader, verse by verse, with the surah-opening basmala rendered as the separate segment it is
- `/[surah]/[ayah]` — single verse, canonical permalink
- `/[surah]/[from]-[to]` — verse range
- Surah index navigation

Word and root pages are the next prompt. Link to them but do not build them.

## Tests

- Playwright: homepage, a surah, a verse, and a range render; light and dark; desktop and mobile viewport
- Every page renders its content with JavaScript disabled
- Axe accessibility check passes on each page type
- `<Verse>` and `<Token>` each appear in exactly one file — assert by grep in a test
- Copy handler produces the expected string for each variant
- Parser tests from Part A

## Report back

State: the parser fix and which other tests you strengthened, how you verified no-JS rendering, Lighthouse mobile scores for the homepage and a surah page, the corpus load time at server start, and anything in the design system you could not meet and why.
