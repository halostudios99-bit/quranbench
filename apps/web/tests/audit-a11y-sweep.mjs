// Broad accessibility sweep across every public page type, in both themes and at
// two viewports. Wider than the e2e suite, which checks a handful of pages, and
// wider than Lighthouse, which checks one page at one size.
//
// Run:  node tests/audit-a11y-sweep.mjs [origin]
import { chromium } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';

const ORIGIN = process.argv[2] ?? 'https://quranbench.com';

const PATHS = [
  '/',
  '/2',
  '/2/page/3',
  '/2/all',
  '/1/1',
  '/word/quran%3Atanzil-uthmani%3A2%3A43%3A4',
  '/root/z-k-w',
  '/search?q=root%3A%D8%B2%20%D9%83%20%D9%88',
  '/compare',
  '/gloss',
  '/about',
  '/method',
  '/data',
  '/colophon',
  '/identifiers',
  '/investigations',
  '/report',
  '/signin',
  '/signup',
  '/terms/contributor',
  '/nonexistent-page-404',
];

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const browser = await chromium.launch();
const findings = new Map();
let checked = 0;

for (const theme of ['light', 'dark']) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: theme,
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    for (const path of PATHS) {
      try {
        await page.goto(ORIGIN + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.evaluate(() => document.fonts.ready).catch(() => {});
        const res = await new AxeBuilder({ page }).withTags(TAGS).analyze();
        checked += 1;
        for (const v of res.violations) {
          const key = `${v.id}|${v.impact}`;
          if (!findings.has(key)) findings.set(key, { ...v, where: new Set() });
          findings.get(key).where.add(`${path} [${theme}/${vp.name}]`);
        }
      } catch (err) {
        console.log(`  SKIP ${path} [${theme}/${vp.name}] — ${err.message.split('\n')[0]}`);
      }
    }
    await ctx.close();
  }
}
await browser.close();

console.log(`\nChecked ${checked} page renders (${PATHS.length} paths x 2 themes x 2 viewports)\n`);
if (findings.size === 0) {
  console.log('No WCAG 2.0/2.1/2.2 A or AA violations found by axe.');
} else {
  const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
  for (const f of [...findings.values()].sort(
    (a, b) => (order[a.impact] ?? 9) - (order[b.impact] ?? 9),
  )) {
    const w = [...f.where];
    console.log(`[${(f.impact ?? '?').toUpperCase()}] ${f.id} — ${f.help}`);
    console.log(`   affects ${w.length} render(s): ${w.slice(0, 6).join(', ')}${w.length > 6 ? ` (+${w.length - 6} more)` : ''}`);
    const node = f.nodes?.[0];
    if (node) console.log(`   e.g. ${(node.html ?? '').slice(0, 120)}`);
    console.log();
  }
}
