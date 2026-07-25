import { describe, expect, it } from 'vitest';
import { parseQuery } from './parse.js';
function ok(input) {
    const r = parseQuery(input);
    if (!r.ok)
        throw new Error(`expected parse to succeed: ${r.error.message}`);
    return r.query;
}
describe('parseQuery — well-formed', () => {
    it('quoted string → exact', () => {
        expect(ok('"ٱلزَّكَوٰةَ"')).toEqual({ type: 'exact', text: 'ٱلزَّكَوٰةَ' });
    });
    it('pattern field', () => {
        expect(ok('pattern:مف*ول')).toEqual({ type: 'pattern', pattern: 'مف*ول' });
    });
    it('bare word → normalised', () => {
        expect(ok('صلوة')).toEqual({ type: 'normalised', text: 'صلوة' });
    });
    it('prefix and suffix fields', () => {
        expect(ok('prefix:الص')).toEqual({ type: 'prefix', text: 'الص' });
        expect(ok('suffix:وة')).toEqual({ type: 'suffix', text: 'وة' });
    });
    it('verse reference', () => {
        expect(ok('2:43')).toEqual({ type: 'reference', ref: '2:43' });
        expect(ok('2:43-45')).toEqual({ type: 'reference', ref: '2:43-45' });
    });
    it('surah scope AND normalised', () => {
        expect(ok('surah:2,3 AND normalised:الصلوة')).toEqual({
            type: 'and',
            clauses: [
                { type: 'scoped', scope: { surahs: [2, 3] }, query: { type: 'all' } },
                { type: 'normalised', text: 'الصلوة' },
            ],
        });
    });
    it('proximity operator', () => {
        expect(ok('زكوة NEAR/10 صلوة')).toEqual({
            type: 'proximity',
            left: { type: 'normalised', text: 'زكوة' },
            right: { type: 'normalised', text: 'صلوة' },
            distance: 10,
        });
    });
    it('adjacency operator', () => {
        expect(ok('واقيموا FOLLOWED_BY الصلوة')).toEqual({
            type: 'adjacency',
            left: { type: 'normalised', text: 'واقيموا' },
            right: { type: 'normalised', text: 'الصلوة' },
        });
    });
    it('nested boolean: A AND (B OR NOT C)', () => {
        expect(ok('صلوة AND (زكوة OR NOT صيام)')).toEqual({
            type: 'and',
            clauses: [
                { type: 'normalised', text: 'صلوة' },
                {
                    type: 'or',
                    clauses: [
                        { type: 'normalised', text: 'زكوة' },
                        { type: 'not', clause: { type: 'normalised', text: 'صيام' } },
                    ],
                },
            ],
        });
    });
});
describe('parseQuery — malformed returns a typed error with position, never throws', () => {
    const cases = [
        ['', /empty query/, 0],
        ['"unterminated', /unterminated quoted string/, 0],
        ['صلوة AND', /unexpected end of query/, 5],
        ['NEAR/abc', /malformed NEAR operator/, 0],
        ['(صلوة OR زكوة', /expected '\)'/, 9],
        ['surah:200', /out of range/, 0],
        ['surah:x', /invalid surah number/, 0],
        [')', /unexpected '\)'/, 0],
        ['foo:bar', /unknown field or malformed reference/, 0],
        ['pattern:', /empty value/, 0],
        ['AND صلوة', /expected a term but found operator/, 0],
    ];
    for (const [input, pattern, position] of cases) {
        it(`rejects ${JSON.stringify(input)}`, () => {
            const r = parseQuery(input);
            expect(r.ok).toBe(false);
            if (!r.ok) {
                expect(r.error.message).toMatch(pattern);
                expect(r.error.position).toBe(position);
            }
        });
    }
});
//# sourceMappingURL=parse.test.js.map