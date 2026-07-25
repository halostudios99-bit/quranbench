'use client';

import { useState } from 'react';

// A copyable citation block. The citation text is rendered server-side (so it is
// present with JavaScript disabled and crawlable); this only adds a copy affordance.
export function CitationCopy({ citation }: { citation: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="select-all rounded-lg border border-line bg-bg px-4 py-3 font-ui text-[13px] leading-relaxed text-ink2">
        {citation}
      </p>
      <button
        type="button"
        onClick={copy}
        className="self-start rounded-lg border border-line bg-panel px-3 py-1.5 font-ui text-[13px] text-ink2 transition-opacity hover:opacity-80"
      >
        {copied ? 'Copied' : 'Copy citation'}
      </button>
    </div>
  );
}
