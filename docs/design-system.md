# Design system

The goal is a tool that feels expensive, calm and fast. Restraint reads as premium. Density reads as amateur.

Benchmark the feel against Stripe, Linear and Apple documentation — quiet, generous, typographically excellent — not against existing Quran sites, which are uniformly cluttered.

---

## 1. Arabic typography

This is 80% of perceived quality. Get it right before anything else.

**Fonts**

- Quranic text: KFGQPC Uthmanic Script HAFS, fallback Amiri Quran
- Arabic UI text: Amiri, fallback system Arabic
- Latin UI: Inter or system stack

**Sizing and rhythm**

- Quranic text never below 24px. Reading view 28–34px. Word pages 36–44px.
- `line-height` minimum 2.0 for text with tashkeel. Diacritics need vertical room; tight leading is the single most common way Arabic typesetting looks cheap.
- Never `letter-spacing` on Arabic. It breaks joining.
- Never `text-transform`, never faux bold or faux italic on Arabic.
- Never justify Quranic text. Use natural line breaks.

**Loading**

Quranic fonts are large — often over 1MB. Naked `font-display: swap` produces a visible flash of fallback Arabic, which looks broken.

- Subset per page to the glyphs actually rendered
- `preload` the subset for the primary text on the route
- `font-display: optional` for Quranic text so a slow font never causes a layout shift
- Self-host. No Google Fonts request for Arabic.

**RTL**

- Real `dir="rtl"` on Arabic content, never a mirrored LTR layout
- Logical CSS properties throughout: `margin-inline-start`, `padding-inline-end`, `border-inline`
- Mixed-direction lines (Arabic word inside English prose) wrapped in `<bdi>`
- Test every layout at both directions before considering it done

---

## 2. Colour

All colour through CSS custom properties. No hardcoded hex in any component, ever.

**Light mode** — warm off-white, not pure white. Paper, not screen. Pure `#fff` behind large Arabic is harsh in long reading sessions.

**Dark mode** — warm near-black (around `#16150f`), never pure `#000`. Pure black with light Arabic text causes halation; the glyphs smear. Dark mode is a first-class reading mode here, not an afterthought.

**Provenance colours** — these carry meaning and are the one place colour is non-decorative:

| Layer | Treatment |
| --- | --- |
| Quranic text | green tag |
| Computed observation | neutral tag |
| External annotation (morphology) | blue tag |
| Translation | neutral tag, always with edition name |
| Editorial (author's voice) | amber tag |
| Community | purple tag |

These tags are structural, not decorative. Every rendered layer carries one.

Contrast: WCAG 2.2 AA minimum, AAA for body text. Arabic at small sizes needs more contrast than Latin — verify with real diacritics, not lorem ipsum.

---

## 3. Motion

**Animate the interface. Never animate scripture.**

Motion on Quranic text — fades, slides, reveals, parallax, typewriter effects — reads as unserious and costs credibility that cannot be bought back. The Arabic appears; it does not perform.

Everything else should move:

| Interaction | Motion |
| --- | --- |
| Bottom sheet | spring, drag-tracked, 300ms settle |
| Word panel change | 150ms crossfade of the panel body only |
| Search results | 200ms stagger, max 8 items, then instant |
| Hover preview | 120ms fade, 200ms delay before showing |
| Theme toggle | 200ms colour transition, no flash |
| Route change | 180ms fade, no slide |

**Rules**

- `transform` and `opacity` only. Never animate `width`, `height`, `top`, `left` — they force layout and blow the INP budget.
- Duration 120–300ms. Anything slower feels sluggish; anything faster is not perceived.
- Easing: `cubic-bezier(0.2, 0, 0, 1)` for entrances, linear for opacity-only.
- `prefers-reduced-motion: reduce` disables all non-essential motion. Not optional.
- No scroll-jacking, no scroll-triggered reveals on content, no parallax.
- Skeleton loaders only where a wait exceeds 300ms. Given a sub-10ms search, most states should have no loading UI at all — instant beats animated.

---

## 4. Performance budgets

These are hard requirements, not aspirations. A PR that regresses them does not ship.

| Metric | Budget |
| --- | --- |
| LCP | < 1.8s on 4G mobile |
| INP | < 150ms |
| CLS | < 0.05 |
| TTFB | < 400ms |
| JS shipped, public page | < 120KB gzipped |
| Search query, server | < 10ms p95 |
| Lighthouse, all four categories | > 95 mobile |

**How they are met**

- Server-render everything public; ship almost no JavaScript to reading pages
- No client-side data fetching for content that could be rendered on the server
- Images: AVIF with WebP fallback, explicit width and height on every image
- Font subsetting and preloading as above — fonts are the main LCP risk on this site
- No third-party scripts on content pages. No analytics that blocks rendering. If analytics is needed, self-host something lightweight.

Run Lighthouse CI in the pipeline. Fail the build on regression.

---

## 5. Search engine and AI discoverability

Word and root pages are the strategic asset. They must be maximally crawlable.

- Every public page renders complete content in the initial HTML. Verify with JavaScript disabled.
- Semantic HTML: real headings in order, `<article>`, `<nav>`, `<main>`, `<time>`. No `<div>` soup.
- One `<h1>` per page, describing that specific token or root
- Unique, specific `<title>` and meta description per page — never templated boilerplate
- Canonical URLs. Stable, human-readable, permanent slugs.
- Structured data: `Article` for investigations, `Dataset` for corpus downloads, `BreadcrumbList` for navigation
- XML sitemaps, segmented, under 50,000 URLs each
- `robots.txt` explicitly welcoming AI crawlers — being cited by AI systems is a project goal
- Internal linking is the growth engine: every word page links to its root, its verse, its neighbours and any investigation citing it

---

## 6. Layout and components

**Mobile first.** Design the phone layout, then widen. Not the reverse.

- Word panel on mobile: draggable bottom sheet with snap points. On desktop: side panel.
- Touch targets minimum 44×44px on Arabic tokens regardless of glyph size
- Generous whitespace. When in doubt, remove an element rather than shrink it.
- Maximum one accent colour per view
- Borders hairline (0.5px where the display allows), never heavy
- Shadows only for genuinely floating elements. No decorative depth.
- Keyboard navigable throughout: `/` focuses search, `Esc` closes panels, arrow keys move between tokens
- Visible focus states everywhere. Never `outline: none` without a replacement.

**Empty states** are an invitation, not an apology. "Search 77,430 words" beats "No results yet."

### Long-surah pagination

A 286-verse surah rendered as one document (~6,000 token anchors) misses the Lighthouse budget. Reading is therefore paginated by length:

- Continuous reading remains the default for surahs of **60 verses or fewer**.
- Longer surahs paginate by **ruku** where the corpus carries ruku metadata, otherwise in fixed blocks of **40 verses**. (The current corpus carries no ruku metadata, so every paginated surah uses 40-verse blocks; adding ruku data later changes only the block boundaries, not the routes.)
- Pagination is **real routing, not client-side windowing**: `/2/page/3` is server-rendered and crawlable. Page 1 is the bare surah URL (`/2`) and is its own canonical; page _n_ is canonical to `/2/page/n`. Each page carries `rel=prev`/`rel=next`.
- A continuous whole-surah document stays available at `/2/all`, marked `noindex` — the paginated pages are the canonical crawlable surface.
- Every verse remains addressable at `/2/43` regardless of which page it falls on.
- Occurrence lists on root pages paginate on the same principle: `/root/z-k-w` is occurrence page 1, `/root/z-k-w/page/2` onward, 20 verses per page.

Budget: Lighthouse mobile performance stays above 95 on every paginated reader page.

---

## 7. What not to do

- No carousels
- No hero videos
- No decorative gradients or mesh backgrounds
- No animated counters
- No cookie banner beyond what law requires
- No newsletter modal on first visit
- No "AI-powered" badges or marketing language in the product UI
- No emoji in the interface
- No animation on Quranic text, under any circumstances
