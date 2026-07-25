import { getCorpus, getTextEdition } from '@/server/corpus';
import { ProvenanceTag } from './ProvenanceTag';

// The site-wide provenance line. Every page states which text edition and corpus
// version produced what it shows — reproducibility applied to the page itself.
export function SiteFooter() {
  const corpus = getCorpus();
  const edition = getTextEdition();
  return (
    <footer className="mt-16 border-t border-line bg-panel">
      <div className="mx-auto max-w-wrap px-5 py-7 sm:px-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ProvenanceTag layer="quran" note={edition} />
          <ProvenanceTag layer="external" note="Leeds QAC (GPL)" />
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-ink3">
          <div className="flex gap-1.5">
            <dt>Text:</dt>
            <dd className="text-ink2">{edition}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Corpus:</dt>
            <dd className="text-ink2">v{corpus.version} · open data</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Tashkeel counted:</dt>
            <dd className="text-ink2">no</dd>
          </div>
          <div className="flex gap-1.5">
            <dt>Numbering:</dt>
            <dd className="text-ink2">{corpus.manifest.numbering.active}</dd>
          </div>
        </dl>
        <p className="mt-4 max-w-2xl text-[12px] leading-relaxed text-ink3">
          Quranic text is immutable and attributed to Tanzil. Morphology is derived from the Leeds
          Quranic Arabic Corpus and is licensed GPL-2.0-or-later. Do not accept an interpretation —
          open the evidence and reproduce the search yourself.
        </p>
      </div>
    </footer>
  );
}
