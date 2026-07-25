import { PROVENANCE, type ProvenanceLayer } from '@/lib/provenance';

// Every rendered layer carries exactly one provenance tag (design-system §2).
// Colour is structural: it resolves to the per-layer CSS custom properties so it
// holds in light and dark without a hardcoded value in the component.

interface ProvenanceTagProps {
  layer: ProvenanceLayer;
  /** Extra qualifier, e.g. a translation edition name or the text edition. */
  note?: string | undefined;
  className?: string | undefined;
}

export function ProvenanceTag({ layer, note, className }: ProvenanceTagProps) {
  const meta = PROVENANCE[layer];
  const style = {
    color: `var(--prov-${layer}-fg)`,
    background: `var(--prov-${layer}-bg)`,
    borderColor: `var(--prov-${layer}-line)`,
  } as const;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none ${className ?? ''}`}
      style={style}
      data-provenance={layer}
      title={meta.description}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: `var(--prov-${layer}-fg)` }}
      />
      <span>
        {meta.label}
        {note ? <span className="font-normal"> · {note}</span> : null}
      </span>
    </span>
  );
}
