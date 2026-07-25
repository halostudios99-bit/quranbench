import { canonicaliseUthmani, normaliseArabic } from './normalise.js';
import { resolveReference } from './reference.js';
import { UnsupportedQueryError } from './types.js';
// The evaluator. Every query reduces to a set of token handles (integer indices
// into index.tokens). Set algebra composes booleans; positional joins over
// sorted handle lists give proximity and adjacency without scanning the corpus.
function sorted(set) {
    return [...set].sort((a, b) => a - b);
}
function unionPostings(index, keys) {
    const out = new Set();
    for (const key of keys) {
        const postings = index.normalised.get(key);
        if (postings)
            for (const h of postings)
                out.add(h);
    }
    return out;
}
function patternToRegExp(pattern) {
    let src = '^';
    for (const ch of pattern) {
        if (ch === '*')
            src += '.*';
        else if (ch === '?')
            src += '.';
        else
            src += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    src += '$';
    return new RegExp(src);
}
function scopeContains(index, handle, scope) {
    const surah = index.tokens[handle].surah;
    if (scope.surahs && !scope.surahs.includes(surah))
        return false;
    if (scope.segmentRange) {
        const range = scope.segmentRange;
        if (surah !== range.surah)
            return false;
        const segment = index.segmentById.get(index.segmentIdOf[handle]);
        const ordinal = segment?.ordinals[index.activeScheme];
        if (ordinal === undefined || ordinal < range.from || ordinal > range.to)
            return false;
    }
    return true;
}
function proximityJoin(index, a, b, distance, crossSegment) {
    const out = new Set();
    let lo = 0;
    for (const y of b) {
        while (lo < a.length && a[lo] < y - distance)
            lo++;
        let k = lo;
        let paired = false;
        while (k < a.length && a[k] <= y + distance) {
            const x = a[k];
            if (x !== y && (crossSegment || index.segmentIdOf[x] === index.segmentIdOf[y])) {
                out.add(x);
                paired = true;
            }
            k++;
        }
        if (paired)
            out.add(y);
    }
    return out;
}
function adjacencyJoin(index, left, right) {
    const out = new Set();
    for (const r of right) {
        const l = r - 1;
        if (l >= 0 && left.has(l) && index.segmentIdOf[l] === index.segmentIdOf[r]) {
            out.add(l);
            out.add(r);
        }
    }
    return out;
}
/** Evaluate a query to the set of matching token handles. */
export function evaluate(index, query) {
    switch (query.type) {
        case 'exact': {
            const postings = index.exact.get(canonicaliseUthmani(query.text));
            return new Set(postings ?? []);
        }
        case 'normalised': {
            const postings = index.normalised.get(normaliseArabic(query.text));
            return new Set(postings ?? []);
        }
        case 'prefix': {
            const needle = normaliseArabic(query.text);
            const keys = [];
            for (const key of index.normalised.keys())
                if (key.startsWith(needle))
                    keys.push(key);
            return unionPostings(index, keys);
        }
        case 'suffix': {
            const needle = normaliseArabic(query.text);
            const keys = [];
            for (const key of index.normalised.keys())
                if (key.endsWith(needle))
                    keys.push(key);
            return unionPostings(index, keys);
        }
        case 'pattern': {
            const re = patternToRegExp(normaliseArabic(query.pattern));
            const keys = [];
            for (const key of index.normalised.keys())
                if (re.test(key))
                    keys.push(key);
            return unionPostings(index, keys);
        }
        case 'proximity': {
            const a = sorted(evaluate(index, query.left));
            const b = sorted(evaluate(index, query.right));
            return proximityJoin(index, a, b, query.distance, query.crossSegment ?? false);
        }
        case 'adjacency': {
            const left = evaluate(index, query.left);
            const right = sorted(evaluate(index, query.right));
            return adjacencyJoin(index, left, right);
        }
        case 'and': {
            if (query.clauses.length === 0)
                return new Set();
            // Intersect smallest-first.
            const sets = query.clauses.map((c) => evaluate(index, c)).sort((x, y) => x.size - y.size);
            const [first, ...rest] = sets;
            const out = new Set();
            for (const h of first) {
                if (rest.every((s) => s.has(h)))
                    out.add(h);
            }
            return out;
        }
        case 'or': {
            const out = new Set();
            for (const clause of query.clauses) {
                for (const h of evaluate(index, clause))
                    out.add(h);
            }
            return out;
        }
        case 'not': {
            const excluded = evaluate(index, query.clause);
            const out = new Set();
            for (let i = 0; i < index.tokens.length; i++)
                if (!excluded.has(i))
                    out.add(i);
            return out;
        }
        case 'scoped': {
            const inner = evaluate(index, query.query);
            const out = new Set();
            for (const h of inner)
                if (scopeContains(index, h, query.scope))
                    out.add(h);
            return out;
        }
        case 'all': {
            const out = new Set();
            for (let i = 0; i < index.tokens.length; i++)
                out.add(i);
            return out;
        }
        case 'reference': {
            const segments = resolveReference(index, query.ref) ?? [];
            const out = new Set();
            for (const segment of segments) {
                const handles = index.segmentTokens.get(segment.id);
                if (handles)
                    for (const h of handles)
                        out.add(h);
            }
            return out;
        }
        case 'root':
        case 'lemma':
            throw new UnsupportedQueryError(query.type);
    }
}
//# sourceMappingURL=evaluate.js.map