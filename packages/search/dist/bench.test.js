import { loadCorpus } from '@quranbench/corpus';
import { describe, expect, it } from 'vitest';
import { buildIndex } from './build-index.js';
import { search } from './search.js';
// Hard performance budgets on the real corpus. The number matters more than the
// pass: if a budget is missed the reported figure is the finding, not a reason
// to loosen the budget. Speed is the primary UX goal (CLAUDE.md).
const BUILD_BUDGET_MS = 2000;
const SINGLE_TERM_P95_MS = 10;
const PROXIMITY_P95_MS = 25;
function percentile(samples, p) {
    const sorted = [...samples].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    return sorted[idx];
}
function timeP95(runs, fn) {
    for (let i = 0; i < 20; i++)
        fn(); // warm up
    const samples = [];
    for (let i = 0; i < runs; i++) {
        const t0 = performance.now();
        fn();
        samples.push(performance.now() - t0);
    }
    return percentile(samples, 95);
}
describe('performance budgets', () => {
    const corpus = loadCorpus();
    it(`builds the index in under ${BUILD_BUDGET_MS}ms`, () => {
        const t0 = performance.now();
        const index = buildIndex(corpus);
        const ms = performance.now() - t0;
        console.log(`[bench] index build: ${ms.toFixed(1)}ms (budget ${BUILD_BUDGET_MS}ms)`);
        expect(index.tokens.length).toBe(77881);
        expect(ms).toBeLessThan(BUILD_BUDGET_MS);
    });
    it(`single-term query p95 under ${SINGLE_TERM_P95_MS}ms`, () => {
        const index = buildIndex(corpus);
        const queries = [
            ['exact', { type: 'exact', text: 'ٱلزَّكَوٰةَ' }],
            ['normalised', { type: 'normalised', text: 'الله' }],
            ['prefix', { type: 'prefix', text: 'الص' }],
            ['suffix', { type: 'suffix', text: 'ون' }],
            ['pattern', { type: 'pattern', pattern: 'مف*ول' }],
        ];
        for (const [label, q] of queries) {
            const p95 = timeP95(200, () => void search(index, q));
            console.log(`[bench] ${label} p95: ${p95.toFixed(3)}ms (budget ${SINGLE_TERM_P95_MS}ms)`);
            expect(p95).toBeLessThan(SINGLE_TERM_P95_MS);
        }
    });
    it(`proximity query p95 under ${PROXIMITY_P95_MS}ms`, () => {
        const index = buildIndex(corpus);
        const q = {
            type: 'proximity',
            left: { type: 'normalised', text: 'الصلوة' },
            right: { type: 'normalised', text: 'الزكوة' },
            distance: 10,
        };
        const p95 = timeP95(200, () => void search(index, q));
        console.log(`[bench] proximity p95: ${p95.toFixed(3)}ms (budget ${PROXIMITY_P95_MS}ms)`);
        expect(p95).toBeLessThan(PROXIMITY_P95_MS);
    });
    it('reports the retained-heap footprint of the loaded index', () => {
        global.gc?.();
        const before = process.memoryUsage().heapUsed;
        const index = buildIndex(corpus);
        global.gc?.();
        const after = process.memoryUsage().heapUsed;
        const mb = (after - before) / (1024 * 1024);
        console.log(`[bench] index heap delta: ${mb.toFixed(1)}MB`);
        expect(index.tokens.length).toBe(77881);
    });
});
//# sourceMappingURL=bench.test.js.map