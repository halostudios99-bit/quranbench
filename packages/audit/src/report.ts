// Rendering: a machine-readable JSON report and a human-readable markdown
// summary per article. The markdown leads with what needs a human decision.

import type { ArticleReport, Finding } from './types.js';

const KIND_LABEL: Record<Finding['kind'], string> = {
  'verse-reference': 'Verse reference',
  'surah-name': 'Surah name',
  'quoted-arabic': 'Quoted Arabic',
  'root-claim': 'Root claim',
  transliteration: 'Transliteration',
};

function renderFinding(f: Finding): string {
  const lines = [
    `- **${f.summary}**`,
    `  - ${KIND_LABEL[f.kind]}${f.status === 'flagged' ? ` · severity: ${f.severity}` : ''} · line ${f.location.line}`,
    `  - source: \`${f.location.excerpt}\``,
  ];
  if (f.detail) lines.push(`  - ${f.detail}`);
  return lines.join('\n');
}

export function renderMarkdown(report: ArticleReport): string {
  const { counts } = report;
  const flagged = report.findings.filter((f) => f.status === 'flagged');
  const unchecked = report.findings.filter((f) => f.status === 'unchecked');
  const verified = report.findings.filter((f) => f.status === 'verified');

  const out: string[] = [];
  out.push(`# Audit — ${report.title}`);
  out.push('');
  out.push(`_${report.file} · corpus ${report.corpusVersion} · slug \`${report.slug}\`_`);
  out.push('');
  out.push(report.provenance);
  out.push('');
  out.push(
    `**${counts.checked} claims checked** — ✅ ${counts.verified} verified · 🚩 ${counts.flagged} flagged · ❔ ${counts.unchecked} unchecked · review score **${report.workScore}**`,
  );
  out.push('');

  if (flagged.length) {
    out.push('## 🚩 Flagged — needs a human decision');
    out.push('');
    for (const f of flagged) out.push(renderFinding(f));
    out.push('');
  } else {
    out.push('## 🚩 Flagged');
    out.push('');
    out.push('_Nothing was flagged by the automated checks._');
    out.push('');
  }

  if (unchecked.length) {
    out.push('## ❔ Could not be checked automatically');
    out.push('');
    for (const f of unchecked) out.push(renderFinding(f));
    out.push('');
  }

  out.push('## ✅ Verified');
  out.push('');
  if (verified.length) {
    const byKind = new Map<string, Finding[]>();
    for (const f of verified) {
      const list = byKind.get(f.kind) ?? [];
      list.push(f);
      byKind.set(f.kind, list);
    }
    for (const [kind, list] of byKind) {
      out.push(`- **${KIND_LABEL[kind as Finding['kind']]}** (${list.length})`);
      for (const f of list) out.push(`  - ${f.summary} _(line ${f.location.line})_`);
    }
  } else {
    out.push('_Nothing verified automatically._');
  }
  out.push('');
  return out.join('\n');
}
