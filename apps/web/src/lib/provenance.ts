// The six provenance layers from docs/design-system.md §2. Every rendered layer
// carries exactly one. The colour is structural, not decorative, and resolves to
// CSS custom properties so it holds in both light and dark modes.

export type ProvenanceLayer =
  | 'quran'
  | 'computed'
  | 'external'
  | 'translation'
  | 'editorial'
  | 'community';

export interface ProvenanceMeta {
  /** Short label shown in the tag. */
  label: string;
  /** Accessible description of what this layer is. */
  description: string;
}

export const PROVENANCE: Record<ProvenanceLayer, ProvenanceMeta> = {
  quran: { label: 'Quranic text', description: 'Immutable source text, attributed to Tanzil' },
  computed: { label: 'Computed', description: 'A computed observation over the corpus' },
  external: { label: 'Morphology', description: 'External annotation (Leeds QAC, GPL)' },
  translation: { label: 'Translation', description: 'A human translation edition' },
  editorial: { label: 'Editorial', description: "An author's editorial voice" },
  community: { label: 'Community', description: 'Community-contributed content' },
};
