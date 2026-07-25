// Copy is a provenance question, not a clipboard question (architecture doc
// §"Copy semantics"). What leaves the site must stay traceable, so every variant
// except "Arabic only" appends the reference and source. These builders are pure
// so they can be unit-tested with no DOM; the clipboard write lives elsewhere.

export type CopyVariant = 'arabic-uthmani' | 'arabic-plain' | 'arabic-ref' | 'citation';

/** Everything a copy payload can need, resolved once on the server. */
export interface CopySource {
  /** Uthmani Arabic, tokens joined by spaces. */
  arabicUthmani: string;
  /** Arabic with tashkeel stripped. */
  arabicPlain: string;
  /** Human reference, e.g. `Al-Baqarah 2:43`. */
  reference: string;
  /** Text edition label, e.g. `Tanzil Uthmani 1.1`. */
  edition: string;
  /** Corpus version, e.g. `0.5.0`. */
  corpusVersion: string;
  /** Canonical absolute URL of the unit. */
  url: string;
}

export interface CopyPayload {
  variant: CopyVariant;
  label: string;
  /** `text/plain` clipboard flavour. */
  text: string;
  /** `text/html` clipboard flavour — preserves RTL and the reference line. */
  html: string;
}

export const COPY_VARIANTS: { variant: CopyVariant; label: string }[] = [
  { variant: 'arabic-uthmani', label: 'Arabic (Uthmani)' },
  { variant: 'arabic-plain', label: 'Arabic without tashkeel' },
  { variant: 'arabic-ref', label: 'Arabic + reference' },
  { variant: 'citation', label: 'Citation (with corpus version)' },
];

function labelFor(variant: CopyVariant): string {
  return COPY_VARIANTS.find((v) => v.variant === variant)!.label;
}

/** The attribution line appended to every variant except Arabic-only. */
export function attributionLine(s: CopySource): string {
  return `— Quran ${s.reference} · ${s.edition} · corpus v${s.corpusVersion} · ${s.url}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function arabicHtml(text: string): string {
  return `<p dir="rtl" lang="ar">${escapeHtml(text)}</p>`;
}

function refHtml(s: CopySource): string {
  const link = `<a href="${escapeHtml(s.url)}">${escapeHtml(s.url)}</a>`;
  return `<p dir="ltr">— Quran ${escapeHtml(s.reference)} · ${escapeHtml(s.edition)} · corpus v${escapeHtml(s.corpusVersion)} · ${link}</p>`;
}

/** Build the plain-text and HTML clipboard flavours for a variant. Pure. */
export function buildCopyPayload(variant: CopyVariant, s: CopySource): CopyPayload {
  const label = labelFor(variant);
  switch (variant) {
    case 'arabic-uthmani':
      // Arabic only carries no attribution — it is the sole exception.
      return { variant, label, text: s.arabicUthmani, html: arabicHtml(s.arabicUthmani) };
    case 'arabic-plain':
      return {
        variant,
        label,
        text: `${s.arabicPlain}\n${attributionLine(s)}`,
        html: `${arabicHtml(s.arabicPlain)}\n${refHtml(s)}`,
      };
    case 'arabic-ref':
      return {
        variant,
        label,
        text: `${s.arabicUthmani}\n${attributionLine(s)}`,
        html: `${arabicHtml(s.arabicUthmani)}\n${refHtml(s)}`,
      };
    case 'citation':
      return {
        variant,
        label,
        text: `${s.arabicUthmani}\nQuran ${s.reference} (${s.edition}). quranbench, corpus v${s.corpusVersion}. ${s.url}`,
        html: `${arabicHtml(s.arabicUthmani)}\n<p dir="ltr">Quran ${escapeHtml(s.reference)} (${escapeHtml(s.edition)}). quranbench, corpus v${escapeHtml(s.corpusVersion)}. <a href="${escapeHtml(s.url)}">${escapeHtml(s.url)}</a></p>`,
      };
  }
}

export function buildAllCopyPayloads(s: CopySource): CopyPayload[] {
  return COPY_VARIANTS.map((v) => buildCopyPayload(v.variant, s));
}
