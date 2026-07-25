import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
export const DEFAULT_CORPUS_VERSION = '0.3.0';
/**
 * Thrown when an artifact fails validation. A corrupted or schema-drifted corpus
 * must never load silently — the invariant the rest of the system relies on is
 * that if `loadCorpus` returns, the corpus matched its manifest exactly.
 */
export class CorpusValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CorpusValidationError';
    }
}
function fail(message) {
    throw new CorpusValidationError(message);
}
/** Default artifacts root: packages/corpus-build/out, resolved from this module. */
function defaultRoot() {
    const here = fileURLToPath(new URL('.', import.meta.url));
    return join(here, '..', '..', 'corpus-build', 'out');
}
function readText(path) {
    try {
        return readFileSync(path, 'utf8');
    }
    catch (cause) {
        fail(`cannot read artifact '${path}': ${cause.message}`);
    }
}
function sha256(text) {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}
function parseJson(path, text) {
    try {
        return JSON.parse(text);
    }
    catch (cause) {
        fail(`artifact '${path}' is not valid JSON: ${cause.message}`);
    }
}
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function requireKeys(where, obj, keys) {
    for (const key of keys) {
        if (!(key in obj))
            fail(`${where}: missing required field '${key}'`);
    }
}
const TOKEN_KEYS = [
    'id',
    'segment_id',
    'surah',
    'slot',
    'position',
    'text_uthmani',
    'text_simple',
    'text_no_tashkeel',
    'text_normalised',
    'char_start',
    'char_end',
    'following_marks',
    'is_basmala',
];
const SEGMENT_KEYS = [
    'id',
    'work_id',
    'source_id',
    'surah',
    'slot',
    'ordinals',
    'text_uthmani',
    'text_simple',
    'text_no_tashkeel',
    'text_normalised',
    'leading_marks',
];
const SURAH_KEYS = [
    'id',
    'number',
    'name_ar',
    'name_translit',
    'name_en',
    'revelation_place',
    'revelation_order',
    'verse_count',
    'basmala',
    'source_id',
];
const SOURCE_KEYS = [
    'id',
    'name',
    'publisher',
    'edition',
    'year',
    'url',
    'licence',
    'role',
    'sha256',
];
function parseJsonl(path, text) {
    const rows = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '')
            continue;
        let parsed;
        try {
            parsed = JSON.parse(line);
        }
        catch (cause) {
            fail(`artifact '${path}' line ${i + 1}: invalid JSON: ${cause.message}`);
        }
        if (!isObject(parsed))
            fail(`artifact '${path}' line ${i + 1}: expected an object`);
        rows.push(parsed);
    }
    return rows;
}
function validateManifest(path, raw, expectedVersion) {
    if (!isObject(raw))
        fail(`${path}: manifest must be an object`);
    requireKeys(path, raw, ['corpus_version', 'counts', 'numbering', 'segmentation_scheme']);
    const version = raw['corpus_version'];
    if (version !== expectedVersion) {
        fail(`${path}: manifest corpus_version '${String(version)}' does not match requested version '${expectedVersion}'`);
    }
    const counts = raw['counts'];
    if (!isObject(counts))
        fail(`${path}: counts must be an object`);
    for (const key of ['surahs', 'verses', 'tokens']) {
        if (typeof counts[key] !== 'number')
            fail(`${path}: counts.${key} must be a number`);
    }
    const numbering = raw['numbering'];
    if (!isObject(numbering))
        fail(`${path}: numbering must be an object`);
    if (typeof numbering['active'] !== 'string')
        fail(`${path}: numbering.active must be a string`);
    if (!Array.isArray(numbering['available']))
        fail(`${path}: numbering.available must be an array`);
    return raw;
}
/**
 * Read and validate corpus artifacts for `version` from disk, returning typed
 * in-memory structures. Fails loudly — throws {@link CorpusValidationError} — on
 * schema drift or a count that disagrees with the manifest, so a corrupted
 * corpus can never load silently.
 */
export function loadCorpus(version = DEFAULT_CORPUS_VERSION, options = {}) {
    const root = options.root ?? defaultRoot();
    const dir = join(root, `v${version}`);
    const paths = {
        manifest: join(dir, 'manifest.json'),
        sources: join(dir, 'sources.json'),
        surahs: join(dir, 'surahs.json'),
        verses: join(dir, 'verses.jsonl'),
        tokens: join(dir, 'tokens.jsonl'),
    };
    const manifestText = readText(paths.manifest);
    const manifest = validateManifest(paths.manifest, parseJson(paths.manifest, manifestText), version);
    const checksums = { 'manifest.json': sha256(manifestText) };
    const sourcesText = readText(paths.sources);
    checksums['sources.json'] = sha256(sourcesText);
    const sourcesRaw = parseJson(paths.sources, sourcesText);
    if (!Array.isArray(sourcesRaw))
        fail(`${paths.sources}: expected an array`);
    const sources = sourcesRaw.map((row, i) => {
        if (!isObject(row))
            fail(`${paths.sources}[${i}]: expected an object`);
        requireKeys(`${paths.sources}[${i}]`, row, SOURCE_KEYS);
        return row;
    });
    const surahsText = readText(paths.surahs);
    checksums['surahs.json'] = sha256(surahsText);
    const surahsRaw = parseJson(paths.surahs, surahsText);
    if (!Array.isArray(surahsRaw))
        fail(`${paths.surahs}: expected an array`);
    const surahs = surahsRaw.map((row, i) => {
        if (!isObject(row))
            fail(`${paths.surahs}[${i}]: expected an object`);
        requireKeys(`${paths.surahs}[${i}]`, row, SURAH_KEYS);
        return row;
    });
    const numbering = new Map();
    for (const id of manifest.numbering.available) {
        const numPath = join(dir, 'numbering', `${id}.json`);
        const numText = readText(numPath);
        checksums[`numbering/${id}.json`] = sha256(numText);
        const numRaw = parseJson(numPath, numText);
        if (!isObject(numRaw))
            fail(`${numPath}: expected an object`);
        requireKeys(numPath, numRaw, ['id', 'name', 'rules']);
        numbering.set(id, numRaw);
    }
    const versesText = readText(paths.verses);
    checksums['verses.jsonl'] = sha256(versesText);
    const versesRaw = parseJsonl(paths.verses, versesText);
    const segments = versesRaw.map((row, i) => {
        requireKeys(`${paths.verses} row ${i + 1}`, row, SEGMENT_KEYS);
        if (!isObject(row['ordinals']))
            fail(`${paths.verses} row ${i + 1}: ordinals must be an object`);
        return row;
    });
    const tokensText = readText(paths.tokens);
    checksums['tokens.jsonl'] = sha256(tokensText);
    const tokensRaw = parseJsonl(paths.tokens, tokensText);
    const tokens = tokensRaw.map((row, i) => {
        requireKeys(`${paths.tokens} row ${i + 1}`, row, TOKEN_KEYS);
        if (typeof row['position'] !== 'number') {
            fail(`${paths.tokens} row ${i + 1}: position must be a number`);
        }
        if (typeof row['is_basmala'] !== 'boolean') {
            fail(`${paths.tokens} row ${i + 1}: is_basmala must be a boolean`);
        }
        return row;
    });
    // Cross-check the loaded shapes against the manifest's declared counts. A
    // mismatch means the artifacts and manifest disagree — refuse to load.
    if (tokens.length !== manifest.counts.tokens) {
        fail(`token count ${tokens.length} does not match manifest.counts.tokens ${manifest.counts.tokens}`);
    }
    if (segments.length !== manifest.counts.verses) {
        fail(`verse count ${segments.length} does not match manifest.counts.verses ${manifest.counts.verses}`);
    }
    if (surahs.length !== manifest.counts.surahs) {
        fail(`surah count ${surahs.length} does not match manifest.counts.surahs ${manifest.counts.surahs}`);
    }
    // Referential integrity: every token belongs to a segment id, and its declared
    // surah is in range. Guards against a build that emitted orphaned tokens.
    const segmentIds = new Set(segments.map((s) => s.id));
    const surahNumbers = new Set(surahs.map((s) => s.number));
    for (const token of tokens) {
        if (token.surah < 1 || !surahNumbers.has(token.surah)) {
            fail(`token '${token.id}' references unknown surah ${token.surah}`);
        }
        // Basmala tokens live in segments that are not verse rows; only verify
        // ordinary (numeric-slot) tokens resolve to a counted segment.
        if (token.slot !== 'basmala' && !segmentIds.has(token.segment_id)) {
            fail(`token '${token.id}' references unknown segment '${token.segment_id}'`);
        }
    }
    return {
        version,
        manifest,
        sources,
        surahs,
        segments,
        tokens,
        numbering,
        checksums,
    };
}
//# sourceMappingURL=load.js.map