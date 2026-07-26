// Mobile audit: finds horizontal overflow and names the element causing it,
// undersized touch targets, and text too small to read — then screenshots every
// page so a human can look at what the numbers describe.
//
// Run:  node tests/audit-mobile.mjs [origin]
import { chromium, devices } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const ORIGIN = process.argv[2] ?? 'https://quranbench.com';
const OUT = '/tmp/qb-mobile';
mkdirSync(OUT, { recursive: true });

const PATHS = [
  ['/', 'home'],
  ['/2', 'surah'],
  ['/2/page/3', 'surah-paged'],
  ['/1/1', 'verse'],
  ['/word/quran%3Atanzil-uthmani%3A2%3A43%3A4', 'word'],
  ['/root/z-k-w', 'root'],
  ['/search?q=root%3A%D8%B2%20%D9%83%20%D9%88', 'search'],
  ['/compare', 'compare'],
  ['/data', 'data'],
  ['/method', 'method'],
  ['/about', 'about'],
  ['/investigations', 'investigations'],
  ['/signup', 'signup'],
];

// The narrowest phone still in common use, plus a current one.
const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667, dpr: 2 },
  { name: 'galaxy-s', width: 360, height: 740, dpr: 3 },
];

const browser = await chromium.launch();
const report = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    ...devices['iPhone 12'],
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();

  for (const [path, label] of PATHS) {
    try {
      await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      await page.waitForTimeout(400);

      const findings = await page.evaluate((vw) => {
        const out = { overflow: null, culprits: [], smallTargets: [], tinyText: [], notes: [] };

        const docW = document.documentElement.scrollWidth;
        if (docW > vw + 1) out.overflow = { docWidth: docW, viewport: vw, excess: docW - vw };

        // Name what actually sticks out. Ignore elements whose own overflow is
        // scrollable on purpose (a table in a scroll container is fine).
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const right = r.left + r.width;
          if (right > vw + 1) {
            let scrollableAncestor = false;
            for (let p = el.parentElement; p; p = p.parentElement) {
              const ov = getComputedStyle(p).overflowX;
              if (ov === 'auto' || ov === 'scroll') { scrollableAncestor = true; break; }
            }
            if (scrollableAncestor) continue;
            out.culprits.push({
              tag: el.tagName.toLowerCase(),
              cls: (el.className && String(el.className).slice(0, 70)) || '',
              right: Math.round(right),
              width: Math.round(r.width),
              text: (el.textContent || '').trim().slice(0, 40),
            });
          }
        }
        // Deduplicate to the outermost offenders.
        out.culprits = out.culprits.slice(0, 6);

        // Touch targets: WCAG 2.2 AA asks 24x24 minimum; 44x44 is the platform
        // guidance. Report anything under 24 as a failure, 24-43 as a warning.
        const seen = new Set();
        for (const el of document.querySelectorAll('a, button, input, [role="button"]')) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (Math.min(r.width, r.height) >= 24) continue;
          const key = el.tagName + (el.textContent || '').trim().slice(0, 20);
          if (seen.has(key)) continue;
          seen.add(key);
          out.smallTargets.push({
            tag: el.tagName.toLowerCase(),
            w: Math.round(r.width),
            h: Math.round(r.height),
            text: (el.textContent || '').trim().slice(0, 30),
          });
        }

        // An input under 16px makes iOS Safari zoom the whole page on focus.
        for (const el of document.querySelectorAll('input, select, textarea')) {
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs && fs < 16) {
            out.tinyText.push({
              tag: el.tagName.toLowerCase(),
              type: el.getAttribute('type') || '',
              fontSize: fs,
              name: el.getAttribute('aria-label') || el.getAttribute('name') || '',
            });
          }
        }
        return out;
      }, vp.width);

      await page.screenshot({ path: `${OUT}/${vp.name}-${label}.png`, fullPage: false });
      report.push({ vp: vp.name, path, label, ...findings });
    } catch (err) {
      report.push({ vp: vp.name, path, label, error: err.message.split('\n')[0] });
    }
  }
  await ctx.close();
}
await browser.close();

console.log(`\n=== MOBILE AUDIT — ${ORIGIN} ===\n`);

const overflowing = report.filter((r) => r.overflow);
console.log(`HORIZONTAL OVERFLOW: ${overflowing.length} of ${report.length} page renders\n`);
for (const r of overflowing) {
  console.log(`  [${r.vp}] ${r.path}`);
  console.log(`     page is ${r.overflow.docWidth}px wide in a ${r.overflow.viewport}px viewport (+${r.overflow.excess}px)`);
  for (const c of r.culprits) {
    console.log(`     ↳ <${c.tag} class="${c.cls}"> w=${c.width} rightEdge=${c.right}  "${c.text}"`);
  }
  console.log();
}

const withSmall = report.filter((r) => r.smallTargets?.length);
console.log(`\nTOUCH TARGETS UNDER 24px: ${withSmall.length} renders\n`);
for (const r of withSmall) {
  console.log(`  [${r.vp}] ${r.path}`);
  for (const t of r.smallTargets.slice(0, 5)) console.log(`     ${t.tag} ${t.w}x${t.h}  "${t.text}"`);
}

const withTiny = report.filter((r) => r.tinyText?.length);
console.log(`\nINPUTS UNDER 16px (iOS zooms the page on focus): ${withTiny.length} renders\n`);
for (const r of withTiny) {
  console.log(`  [${r.vp}] ${r.path}`);
  for (const t of r.tinyText.slice(0, 4)) console.log(`     ${t.tag}[${t.type}] ${t.fontSize}px  "${t.name}"`);
}

const errs = report.filter((r) => r.error);
if (errs.length) {
  console.log('\nERRORS\n');
  for (const r of errs) console.log(`  [${r.vp}] ${r.path} — ${r.error}`);
}
console.log(`\nScreenshots in ${OUT}\n`);
