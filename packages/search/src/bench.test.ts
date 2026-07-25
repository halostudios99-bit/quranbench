import { loadCorpus } from '@quranbench/corpus';
import { beforeAll, describe, expect, it } from 'vitest';

import { buildIndex, type SearchIndex } from './build-index.js';
import { search } from './search.js';
import type { Query } from './types.js';

// Hard performance budgets on the real corpus. The number matters more than the
// pass: if a budget is missed the reported figure is the finding, not a reason
// to loosen the budget. Speed is the primary UX goal (CLAUDE.md).
//
// Every query class the engine supports has a budget here. The earlier
// benchmark covered only single-term and proximity queries — and so passed
// while a scoped query ran ~500× over budget. A benchmark that does not
// exercise a query class cannot protect it, so the whole surface is measured.

const BUILD_BUDGET_MS = 2000;
const EXPECTED_TOKENS = 77881;

/** One measured query class and the p95 latency it must stay under. */
interface Case {
  label: string;
  budgetMs: number;
  query: Query;
}

const CASES: Case[] = [
  { label: 'exact', budgetMs: 10, query: { type: 'exact', text: 'ٱلزَّكَوٰةَ' } },
  { label: 'normalised', budgetMs: 10, query: { type: 'normalised', text: 'الله' } },
  { label: 'prefix', budgetMs: 10, query: { type: 'prefix', text: 'الص' } },
  { label: 'suffix', budgetMs: 10, query: { type: 'suffix', text: 'ون' } },
  { label: 'pattern', budgetMs: 10, query: { type: 'pattern', pattern: 'مف*ول' } },
  {
    label: 'proximity',
    budgetMs: 25,
    query: {
      type: 'proximity',
      left: { type: 'normalised', text: 'الصلوة' },
      right: { type: 'normalised', text: 'الزكوة' },
      distance: 10,
    },
  },
  {
    label: 'adjacency',
    budgetMs: 10,
    query: {
      type: 'adjacency',
      left: { type: 'normalised', text: 'واقيموا' },
      right: { type: 'normalised', text: 'الصلوة' },
    },
  },
  {
    label: 'boolean',
    budgetMs: 10,
    query: {
      type: 'and',
      clauses: [
        {
          type: 'or',
          clauses: [
            { type: 'normalised', text: 'الرحمن' },
            { type: 'normalised', text: 'الرحيم' },
          ],
        },
        { type: 'not', clause: { type: 'normalised', text: 'الله' } },
      ],
    },
  },
  {
    // The defect this benchmark exists to catch: a surah scope must not turn a
    // fast term query into a corpus scan.
    label: 'scoped',
    budgetMs: 1,
    query: {
      type: 'and',
      clauses: [
        { type: 'scoped', scope: { surahs: [2] }, query: { type: 'all' } },
        { type: 'normalised', text: 'الصلوة' },
      ],
    },
  },
  {
    label: 'scoped-segment',
    budgetMs: 1,
    query: {
      type: 'and',
      clauses: [
        { type: 'scoped', scope: { segmentRange: { surah: 2, from: 40, to: 120 } }, query: { type: 'all' } },
        { type: 'normalised', text: 'الصلوة' },
      ],
    },
  },
  { label: 'reference', budgetMs: 10, query: { type: 'reference', ref: '2:255' } },
];

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx]!;
}

function timeP95(runs: number, fn: () => void): number {
  for (let i = 0; i < 20; i++) fn(); // warm up
  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return percentile(samples, 95);
}

describe('performance budgets', () => {
  let index: SearchIndex;

  beforeAll(() => {
    const corpus = loadCorpus();
    const t0 = performance.now();
    index = buildIndex(corpus);
    const ms = performance.now() - t0;
    console.log(`[bench] index build: ${ms.toFixed(1)}ms (budget ${BUILD_BUDGET_MS}ms)`);
    expect(index.tokens.length).toBe(EXPECTED_TOKENS);
    expect(ms).toBeLessThan(BUILD_BUDGET_MS);
  });

  it('every query class stays under its p95 budget', () => {
    const rows: Array<{ query: string; p95: string; budget: string; ok: boolean }> = [];
    const failures: string[] = [];
    for (const { label, budgetMs, query } of CASES) {
      const p95 = timeP95(200, () => void search(index, query));
      const ok = p95 < budgetMs;
      rows.push({
        query: label,
        p95: `${p95.toFixed(3)} ms`,
        budget: `${budgetMs} ms`,
        ok,
      });
      if (!ok) failures.push(`${label}: ${p95.toFixed(3)}ms >= budget ${budgetMs}ms`);
    }
    console.log('[bench] query-class p95 vs budget');
    console.table(rows);
    // Fail loudly, naming every class over budget — a regression cannot pass quietly.
    expect(failures, failures.join('; ')).toEqual([]);
  });

  it('reports the retained-heap footprint of the loaded index', () => {
    global.gc?.();
    const before = process.memoryUsage().heapUsed;
    const rebuilt = buildIndex(loadCorpus());
    global.gc?.();
    const after = process.memoryUsage().heapUsed;
    const mb = (after - before) / (1024 * 1024);
    console.log(`[bench] index heap delta: ${mb.toFixed(1)}MB`);
    expect(rebuilt.tokens.length).toBe(EXPECTED_TOKENS);
  });
});
