// Verification: each extracted claim is checked against the corpus and turned
// into a Finding. Conservative by design — when a check cannot be made reliably
// the finding is 'unchecked', never a silent pass. Nothing is ever corrected.

import type { Segment } from '@quranbench/corpus';
import { canonicaliseUthmani, normaliseArabic, resolveReference } from '@quranbench/search';
import type { AuditContext } from './context.js';
import { consonantBlob, joinRoot, rootsForSkeleton, strongSkeleton } from './context.js';
import type {
  RawArabicQuote,
  RawReference,
  RawRootClaim,
  RawTransliteration,
} from './extract.js';
import {
  arabicConsonants,
  arabicWords,
  consonantOverlap,
  translitConsonants,
} from './text.js';
import type { Finding, SourceLocation } from './types.js';

export function refString(ref: RawReference): string {
  return ref.toVerse > ref.fromVerse
    ? `${ref.surah}:${ref.fromVerse}-${ref.toVerse}`
    : `${ref.surah}:${ref.fromVerse}`;
}

function truncate(s: string, n = 60): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > n ? flat.slice(0, n) + '…' : flat;
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/**
 * How much of `quote`'s consonant skeleton is present, in order-free bigrams, in
 * `verse`'s. Consonant skeletons ignore vowels, hamza seating, dagger-alef and
 * word joining — the ways Uthmani and Imlaei spellings differ — so a correctly
 * cited verse scores ~1 regardless of the article's orthography, while a quote
 * from a different verse scores low.
 */
function consonantCoverage(quoteBlob: string, verseBlob: string): number {
  if (quoteBlob.length === 0) return 1;
  if (quoteBlob.length < 2) return verseBlob.includes(quoteBlob) ? 1 : 0;
  const qb = bigrams(quoteBlob);
  const pool = bigrams(verseBlob);
  let hits = 0;
  for (const b of qb) {
    const i = pool.indexOf(b);
    if (i !== -1) {
      hits++;
      pool.splice(i, 1);
    }
  }
  return hits / qb.length;
}

// Recurring non-Quran sources in the seed articles: hadith collections and the
// Bible. A citation naming one of these is out of scope for the Quran corpus.
const NON_QURAN_SOURCES = new Set([
  'bukhari',
  'muslim',
  'tirmidhi',
  'dawud',
  'dawood',
  'majah',
  'nasai',
  'nasa',
  'ahmad',
  'malik',
  'muwatta',
  'mishkat',
  'bayhaqi',
  'tabari',
  'matthew',
  'mark',
  'luke',
  'john',
  'revelation',
  'genesis',
  'exodus',
  'isaiah',
  'psalms',
  'corinthians',
  'romans',
]);

function namesExternalSource(name: string): boolean {
  return name
    .toLowerCase()
    .split(/[^a-z]+/)
    .some((w) => NON_QURAN_SOURCES.has(w));
}

function verseWordSets(segments: Segment[]): {
  canon: Set<string>;
  norm: Set<string>;
  skel: Set<string>;
} {
  const canon = new Set<string>();
  const norm = new Set<string>();
  const skel = new Set<string>();
  for (const seg of segments) {
    for (const w of seg.text_uthmani.split(/\s+/)) if (w) canon.add(canonicaliseUthmani(w));
    for (const w of seg.text_normalised.split(/\s+/)) {
      if (!w) continue;
      norm.add(w);
      const s = strongSkeleton(w);
      if (s.length >= 2) skel.add(s);
    }
  }
  return { canon, norm, skel };
}

function bestVerse(ctx: AuditContext, quoteBlob: string): { ref: string; ratio: number } | null {
  if (quoteBlob.length === 0) return null;
  let best: { ref: string; ratio: number } | null = null;
  for (const seg of ctx.segmentNormalised) {
    const ratio = consonantCoverage(quoteBlob, seg.cons);
    if (!best || ratio > best.ratio) best = { ref: seg.ref, ratio };
  }
  return best;
}

export function verifyQuote(
  ctx: AuditContext,
  quote: string,
  segments: Segment[],
  rstr: string,
  location: SourceLocation,
): Finding | null {
  const words = arabicWords(quote);
  if (words.length === 0) return null;
  const { canon, norm, skel } = verseWordSets(segments);

  let canonical = 0;
  let normalised = 0;
  let orthographic = 0;
  const unmatched: string[] = [];
  for (const w of words) {
    if (canon.has(canonicaliseUthmani(w))) canonical++;
    else if (norm.has(normaliseArabic(w))) normalised++;
    else {
      const s = strongSkeleton(w);
      if (s.length >= 2 && skel.has(s)) orthographic++;
      else unmatched.push(w);
    }
  }
  const matched = canonical + normalised + orthographic;
  const ratio = matched / words.length;
  const quoteBlob = consonantBlob(quote);
  const verseBlob = segments.map((s) => s.text_normalised).join(' ');
  const cons = consonantCoverage(quoteBlob, consonantBlob(verseBlob));

  if (ratio >= 0.85 || cons >= 0.85) {
    const matchLevel =
      unmatched.length || ratio < 0.85
        ? 'orthographic'
        : orthographic
          ? 'orthographic'
          : normalised
            ? 'normalised'
            : 'canonical';
    return {
      kind: 'quoted-arabic',
      status: 'verified',
      severity: 'low',
      location,
      summary: `Quoted Arabic beside ${rstr} matches the verse (${matched}/${words.length} words exact, ${(cons * 100).toFixed(0)}% consonant match).`,
      detail:
        matchLevel === 'orthographic'
          ? `Matched on the consonant skeleton; some words differ in spelling from the Uthmani text${unmatched.length ? ` (e.g. ${unmatched.slice(0, 4).join(' ')})` : ''}.`
          : 'Every quoted word is present in the cited verse.',
      reference: rstr,
      claimedArabic: truncate(quote, 120),
      matchLevel,
    };
  }

  const best = bestVerse(ctx, quoteBlob);
  const elsewhere = best && best.ref !== rstr && best.ratio >= 0.85 ? best : null;
  return {
    kind: 'quoted-arabic',
    status: 'flagged',
    severity: 'high',
    location,
    summary: elsewhere
      ? `Quoted Arabic beside ${rstr} does not match that verse — it matches ${elsewhere.ref}.`
      : `Quoted Arabic beside ${rstr} does not match that verse (${(cons * 100).toFixed(0)}% consonant match).`,
    detail:
      `Word coverage ${(ratio * 100).toFixed(0)}%, consonant coverage ${(cons * 100).toFixed(0)}%. Unmatched words: ${unmatched.join(' ') || '—'}.` +
      (elsewhere
        ? ` The text is a ${(elsewhere.ratio * 100).toFixed(0)}% consonant match to ${elsewhere.ref}; the citation may be to the wrong verse.`
        : ''),
    reference: rstr,
    claimedArabic: truncate(quote, 120),
    matchLevel: 'none',
  };
}

export function verifySurahName(
  ctx: AuditContext,
  ref: RawReference,
  location: SourceLocation,
): Finding | null {
  if (!ref.surahName) return null;
  const canonical = ctx.surahs.canonical(ref.surah);
  if (!canonical) return null;
  const score = ctx.surahs.score(ref.surahName, ref.surah);

  if (score >= 0.55) {
    return {
      kind: 'surah-name',
      status: 'verified',
      severity: 'low',
      location,
      summary: `Surah name "${ref.surahName}" matches surah ${ref.surah} (${canonical.name_translit}).`,
      detail: score >= 0.85 ? 'Exact name match.' : 'Accepted as a spelling variant.',
      reference: refString(ref),
    };
  }

  const best = ctx.surahs.bestMatch(ref.surahName);
  const bestSurah = best ? ctx.surahs.canonical(best.number) : undefined;
  return {
    kind: 'surah-name',
    status: 'flagged',
    severity: 'medium',
    location,
    summary: `Surah name "${ref.surahName}" does not match surah ${ref.surah} (${canonical.name_translit}).`,
    detail: bestSurah
      ? `"${ref.surahName}" best matches surah ${best!.number} (${bestSurah.name_translit}). The name and the number ${ref.surah}:${ref.fromVerse} disagree — one of them is wrong.`
      : `The name and the number ${ref.surah}:${ref.fromVerse} disagree.`,
    reference: refString(ref),
  };
}

export function verifyReference(
  ctx: AuditContext,
  ref: RawReference,
  location: SourceLocation,
): Finding[] {
  const rstr = refString(ref);
  const findings: Finding[] = [];

  // A three-part citation (8:82:820) or a name that resembles no surah is an
  // external source — a hadith collection or the Bible. The corpus cannot verify
  // it; say so plainly rather than treating it as a malformed Quran reference.
  const nameMatch = ref.surahName ? ctx.surahs.bestMatch(ref.surahName) : null;
  const external =
    ref.triple ||
    (ref.surahName !== null &&
      (namesExternalSource(ref.surahName) || (nameMatch?.score ?? 0) < 0.45));
  if (external) {
    return [
      {
        kind: 'verse-reference',
        status: 'unchecked',
        severity: 'low',
        location,
        summary: `"${ref.raw}" looks like an external citation, not a Quran verse — not checkable against the corpus.`,
        detail:
          'Hadith and scripture citations outside the Quran are out of scope for this corpus. A human should confirm the source.',
        reference: rstr,
      },
    ];
  }

  const segments = resolveReference(ctx.index, rstr);

  if (!segments || segments.length === 0) {
    const canonical = ctx.surahs.canonical(ref.surah);
    findings.push({
      kind: 'verse-reference',
      status: 'flagged',
      severity: 'high',
      location,
      summary: `Reference ${ref.raw} does not resolve to a verse in the corpus.`,
      detail: canonical
        ? `Surah ${ref.surah} (${canonical.name_translit}) has ${canonical.verse_count} verses; ${rstr} is out of range or malformed.`
        : `Surah ${ref.surah} does not exist (valid range 1–114).`,
      reference: rstr,
    });
    // A resolvable name may still show which surah the author meant.
    const nameFinding = verifySurahName(ctx, ref, location);
    if (nameFinding) findings.push(nameFinding);
    return findings;
  }

  const tokenIds = segments.flatMap((seg) =>
    (ctx.index.segmentTokens.get(seg.id) ?? []).map((h) => ctx.index.tokens[h]!.id),
  );
  findings.push({
    kind: 'verse-reference',
    status: 'verified',
    severity: 'low',
    location,
    summary: `Reference ${ref.raw} resolves to ${segments.length} verse(s) in the corpus.`,
    detail: `Resolved to ${segments.map((s) => s.id).join(', ')}.`,
    reference: rstr,
    segmentIds: segments.map((s) => s.id),
    tokenIds,
  });

  const nameFinding = verifySurahName(ctx, ref, location);
  if (nameFinding) findings.push(nameFinding);

  if (ref.arabic) {
    const quoteFinding = verifyQuote(ctx, ref.arabic, segments, rstr, location);
    if (quoteFinding) findings.push(quoteFinding);
  }
  return findings;
}

export function verifyLooseArabic(
  ctx: AuditContext,
  quote: RawArabicQuote,
  location: SourceLocation,
): Finding | null {
  const words = arabicWords(quote.text);
  if (words.length === 0) return null;
  const absent: string[] = [];
  let variant = 0;
  for (const w of words) {
    if (ctx.index.exact.has(canonicaliseUthmani(w)) || ctx.index.normalised.has(normaliseArabic(w)))
      continue;
    const s = strongSkeleton(w);
    if (s.length >= 2 && ctx.skeletons.has(s)) variant++;
    // Short function words (يا, ما) are often joined onto the next token in the
    // Uthmani text and so are absent as standalone forms — not an error. Only
    // flag words with enough letters to be a content word we can trust.
    else if (normaliseArabic(w).length >= 3) absent.push(w);
  }
  if (absent.length === 0) {
    return {
      kind: 'quoted-arabic',
      status: 'verified',
      severity: 'low',
      location,
      summary: `Arabic "${truncate(quote.text)}" appears in the corpus (${words.length} word(s)).`,
      detail: variant
        ? `${variant} word(s) present only as an orthographic variant (article uses a non-Uthmani spelling); the exact form is not in the corpus.`
        : 'Every word occurs somewhere in the corpus (not necessarily contiguously).',
      claimedArabic: truncate(quote.text, 120),
      ...(variant ? { matchLevel: 'orthographic' as const } : {}),
    };
  }
  return {
    kind: 'quoted-arabic',
    status: 'flagged',
    severity: absent.length === words.length ? 'high' : 'medium',
    location,
    summary: `Arabic "${truncate(quote.text)}" has ${absent.length}/${words.length} word(s) not found in the corpus, even allowing for spelling variation.`,
    detail: `Not found: ${absent.join(' ')}. This may be a typo, a truncated fragment, or non-Quranic text.`,
    claimedArabic: truncate(quote.text, 120),
    matchLevel: 'none',
  };
}

export function verifyRootClaim(
  ctx: AuditContext,
  claim: RawRootClaim,
  location: SourceLocation,
): Finding {
  const base = {
    kind: 'root-claim' as const,
    location,
    claimedRoot: claim.claimedRoot,
  };
  if (!claim.targetArabic) {
    return {
      ...base,
      status: 'unchecked',
      severity: 'low',
      summary: `Root claim for "${claim.targetTerm}": could not identify the Arabic word to confirm its root.`,
      detail: `Claimed root: "${claim.claimedRoot}". No Arabic form of the target word was found nearby.`,
    };
  }

  const words = arabicWords(claim.targetArabic);
  let corpusRoots: string[] = [];
  let chosen: string | undefined;
  for (const w of [...words].reverse()) {
    const skel = strongSkeleton(w);
    const roots = rootsForSkeleton(ctx, skel);
    if (skel.length >= 2 && roots.length) {
      corpusRoots = roots;
      chosen = w;
      break;
    }
  }

  if (!chosen || corpusRoots.length === 0) {
    return {
      ...base,
      status: 'unchecked',
      severity: 'low',
      summary: `Root claim for "${claim.targetTerm}": word "${claim.targetArabic}" not located in the corpus.`,
      detail: `Claimed root: "${claim.claimedRoot}". Could not match the word to a root-bearing corpus token.`,
    };
  }

  const claimedJoined = joinRoot(claim.claimedRoot);
  const corpusJoined = new Set(corpusRoots.map(joinRoot));
  const dominant = corpusRoots[0]!;
  const others = corpusRoots.slice(1, 4);

  if (corpusJoined.has(claimedJoined)) {
    return {
      ...base,
      status: 'verified',
      severity: 'low',
      summary: `Root claim: root of "${chosen}" is "${claim.claimedRoot}" — matches the corpus.`,
      detail: `Corpus root for this word: ${dominant}${others.length ? ` (skeleton also seen for: ${others.join(', ')})` : ''}.`,
      corpusRoots,
    };
  }

  return {
    ...base,
    status: 'flagged',
    severity: 'high',
    summary: `Root claim: article says the root of "${claim.targetTerm || chosen}" is "${claim.claimedRoot}", but the corpus root is ${dominant}.`,
    detail: `The corpus records root ${dominant} for "${chosen}"${others.length ? ` (nearby forms also draw on ${others.join(', ')})` : ''}. "${claim.claimedRoot}" is not that root — it is likely a derived form, not the triliteral root.`,
    corpusRoots,
  };
}

export function verifyTransliteration(
  pair: RawTransliteration,
  location: SourceLocation,
): Finding | null {
  const ac = arabicConsonants(pair.arabic);
  const tc = translitConsonants(pair.translit);
  if (ac.length < 2 || tc.length < 2) return null;
  const overlap = consonantOverlap(tc, ac);
  if (overlap >= 0.34) {
    return {
      kind: 'transliteration',
      status: 'verified',
      severity: 'low',
      location,
      summary: `Transliteration "${pair.translit}" is consistent with "${pair.arabic}".`,
      detail: `Consonant overlap ${(overlap * 100).toFixed(0)}%.`,
      claimedArabic: pair.arabic,
    };
  }
  // Low overlap does not prove the transliteration is wrong — the Latin word may
  // be a translation gloss, or use a scheme this coarse check does not model.
  // Surface it for a human rather than asserting an error.
  return {
    kind: 'transliteration',
    status: 'unchecked',
    severity: 'low',
    location,
    summary: `Transliteration/gloss "${pair.translit}" for "${pair.arabic}" could not be confirmed.`,
    detail: `Consonant overlap only ${(overlap * 100).toFixed(0)}%. This may be a translation rather than a transliteration, or a scheme not modelled here — worth a human glance.`,
    claimedArabic: pair.arabic,
  };
}
