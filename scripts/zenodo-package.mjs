#!/usr/bin/env node
//
// Package a published corpus version for a Zenodo deposit: the redistributable
// data tarball plus everything an outside researcher needs to understand, verify,
// cite and reuse it — a CITATION.cff, Zenodo deposition metadata, a dataset
// README, per-component licences, and a checksum manifest. It uploads nothing;
// depositing is a documented manual step (see docs/zenodo.md).
//
// Usage:
//   node scripts/zenodo-package.mjs [version]      # e.g. 0.8.0; default: latest on disk
//
// Output: zenodo-deposit/quranbench-corpus-v<version>/

import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const artifactsRoot = join(repoRoot, 'packages', 'corpus-build', 'out');

function latestVersion() {
  const re = /^v(\d+\.\d+\.\d+)$/;
  const versions = readdirSync(artifactsRoot)
    .map((n) => re.exec(n)?.[1])
    .filter(Boolean)
    .sort((a, b) => {
      const pa = a.split('.').map(Number);
      const pb = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) if (pb[i] !== pa[i]) return pb[i] - pa[i];
      return 0;
    });
  if (versions.length === 0) {
    console.error(`No corpus versions found under ${artifactsRoot}`);
    process.exit(1);
  }
  return versions[0];
}

const version = (process.argv[2] || latestVersion()).replace(/^v/, '');
const srcDir = join(artifactsRoot, `v${version}`);
if (!existsSync(srcDir)) {
  console.error(`No such corpus version: ${srcDir}`);
  process.exit(1);
}

const manifest = JSON.parse(
  readFileSync(join(srcDir, 'manifest.json'), 'utf8'),
);
const sources = existsSync(join(srcDir, 'sources.json'))
  ? JSON.parse(readFileSync(join(srcDir, 'sources.json'), 'utf8'))
  : [];

const outDir = join(
  repoRoot,
  'zenodo-deposit',
  `quranbench-corpus-v${version}`,
);
rmSync(outDir, { recursive: true, force: true });
mkdirSync(join(outDir, 'LICENSES'), { recursive: true });

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// ── 1. Copy the redistributable data tarball + its checksum + the manifest ────
const tarball = `quranbench-corpus-v${version}.tar.gz`;
for (const f of [
  tarball,
  `${tarball}.sha256`,
  'manifest.json',
  'sources.json',
]) {
  const from = join(srcDir, f);
  if (existsSync(from)) copyFileSync(from, join(outDir, f));
}
if (!existsSync(join(outDir, tarball))) {
  console.error(
    `Expected the redistributable tarball ${tarball} in ${srcDir}. Build the ` +
      `corpus version first (packages/corpus-build).`,
  );
  process.exit(1);
}

// ── 2. Copy every licence / attribution file, preserving its relative path ────
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/LICENSE|LICENCE|ATTRIBUTION/i.test(name)) {
      const rel = relative(srcDir, p);
      const dest = join(outDir, 'LICENSES', rel);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(p, dest);
    }
  }
}
walk(srcDir);

// ── 3. Metadata: which upstreams, which licences ──────────────────────────────
const counts = manifest.counts ?? {};
const builtAt = manifest.built_at ?? manifest.builtAt ?? '';
const dateReleased = builtAt.slice(0, 10) || '';
const redistributableSources = sources.filter(
  (s) => s.redistributable !== false,
);
const licenceSet = [
  ...new Set(redistributableSources.map((s) => s.licence).filter(Boolean)),
];

// ── 4. CITATION.cff ───────────────────────────────────────────────────────────
const cff = `cff-version: 1.2.0
message: "If you use this dataset, please cite it as below."
title: "quranbench corpus, v${version}"
abstract: >-
  A versioned, checksummed corpus of the Qur'an as addressable research objects:
  the Tanzil Qur'anic text (CC BY 3.0), Leeds Quranic Arabic Corpus morphology
  (GPL-2.0-or-later), and public-domain translation editions, with a full
  provenance manifest. Every artifact is reproducible from the pipeline in
  packages/corpus-build.
type: dataset
version: "${version}"
${dateReleased ? `date-released: "${dateReleased}"` : ''}
license: other-open
repository-code: "https://github.com/quranbench/quranbench"
url: "https://quranbench.com"
keywords:
  - Quran
  - Arabic
  - corpus linguistics
  - morphology
  - Quranic Arabic Corpus
  - Tanzil
authors:
  - name: "quranbench"
`;
writeFileSync(join(outDir, 'CITATION.cff'), cff);

// ── 5. Zenodo deposition metadata (zenodo.json) ───────────────────────────────
const relatedFromSources = redistributableSources
  .filter((s) => s.url)
  .map((s) => ({
    relation: 'isDerivedFrom',
    identifier: s.url,
    resource_type: 'dataset',
  }));

const zenodo = {
  metadata: {
    title: `quranbench corpus, v${version}`,
    upload_type: 'dataset',
    version,
    publication_date: dateReleased || undefined,
    description:
      `<p>A versioned, checksummed corpus of the Qur'an built for reproducible research: ` +
      `${counts.tokens ?? 'all'} tokens across ${counts.verses ?? 'all'} verses, each an ` +
      `addressable object. It bundles the Tanzil Qur'anic text, Leeds Quranic Arabic Corpus ` +
      `morphology, and public-domain English translation editions, with a manifest recording ` +
      `the exact source editions, build parameters and a SHA-256 for every artifact.</p>` +
      `<p><strong>Licensing is mixed</strong> — see the README and LICENSES/ directory. In short: ` +
      `Tanzil text is CC BY 3.0; the morphology (and any file embedding it, e.g. tokens.jsonl and ` +
      `morphology/roots.json) is GPL-2.0-or-later; translation editions are per-edition ` +
      `public-domain. Display-only, non-redistributable editions are deliberately excluded.</p>` +
      `<p>Everything here is reproducible from the open pipeline at ` +
      `<a href="https://github.com/quranbench/quranbench">github.com/quranbench/quranbench</a> ` +
      `(packages/corpus-build).</p>`,
    access_right: 'open',
    // Mixed licensing: the deposit as a whole is marked other-open and the exact
    // per-component licences are stated in the README and LICENSES/ directory.
    license: 'other-open',
    keywords: [
      'Quran',
      'Arabic',
      'corpus linguistics',
      'morphology',
      'Quranic Arabic Corpus',
      'Tanzil',
      'reproducible research',
    ],
    notes:
      `Component licences: ${licenceSet.join(', ')} for text/translations, and ` +
      `GPL-2.0-or-later for the Leeds QAC morphology and anything embedding it. ` +
      `Corpus version ${version}; every file's SHA-256 is in manifest.json and CHECKSUMS.sha256.`,
    related_identifiers: [
      {
        relation: 'isSupplementTo',
        identifier: 'https://quranbench.com',
        resource_type: 'other',
      },
      ...relatedFromSources,
    ],
  },
};
writeFileSync(
  join(outDir, 'zenodo.json'),
  JSON.stringify(zenodo, null, 2) + '\n',
);

// ── 6. Researcher-facing README ───────────────────────────────────────────────
const sourceRows = sources
  .map(
    (s) =>
      `| ${s.name ?? s.id} | ${s.role ?? '—'} | ${s.licence ?? '—'} | ${
        s.redistributable === false ? 'excluded (display-only)' : 'included'
      } |`,
  )
  .join('\n');

const readme = `# quranbench corpus — v${version}

A versioned, checksummed corpus of the Qur'an as permanent, addressable research
objects. This deposit is a snapshot of one corpus version from
[quranbench.com](https://quranbench.com); it is self-contained and self-verifying.

## What is in this deposit

- \`${tarball}\` — the redistributable corpus artifacts (one gzipped tar).
- \`${tarball}.sha256\` — its checksum.
- \`manifest.json\` — the build manifest: source editions, build parameters,
  numbering, normalisation rules, and a SHA-256 + byte size for **every** artifact.
- \`sources.json\` — the upstream sources with publisher, edition and licence.
- \`CITATION.cff\`, \`zenodo.json\` — citation and deposit metadata.
- \`LICENSES/\` — every upstream licence and attribution file, verbatim.
- \`CHECKSUMS.sha256\` — a SHA-256 for every file in this deposit.

Inside the tarball: \`tokens.jsonl\` (one record per token, with its morphology),
\`verses.jsonl\`, \`surahs.json\`, \`morphology/\` (roots and features), \`translations/\`
(public-domain editions), \`lexicon/\`, plus numbering and identifier-mapping data.

## Contents

- Tokens: ${counts.tokens ?? 'see manifest'}
- Verses: ${counts.verses ?? 'see manifest'}
- Surahs: ${counts.surahs ?? 114}
- Corpus version: ${version}
- Built: ${builtAt || 'see manifest'}

## Verifying integrity

Every file is checksummed. To verify the tarball:

\`\`\`
sha256sum -c ${tarball}.sha256      # or: shasum -a 256 -c
\`\`\`

To verify every file in this deposit:

\`\`\`
sha256sum -c CHECKSUMS.sha256
\`\`\`

\`manifest.json\` additionally records the SHA-256 and byte size of every artifact
inside the tarball, so a downloaded corpus can be confirmed byte-for-byte against
what was built.

## Licensing (read before redistributing)

This dataset is **not under a single licence**. It combines upstreams with
different terms. The full per-file text is in \`LICENSES/\`.

| Source | Role | Licence | In this deposit |
| --- | --- | --- | --- |
${sourceRows}

Key points:

- **Qur'anic text (Tanzil): CC BY 3.0.** Redistribute and adapt with attribution
  to the Tanzil Project.
- **Morphology (Leeds Quranic Arabic Corpus): GPL-2.0-or-later.** Because the GPL
  is copyleft, any file that embeds the morphology — \`tokens.jsonl\` and
  \`morphology/roots.json\` — is GPL-2.0-or-later **as a whole**. To use the Tanzil
  text under CC BY without the GPL obligation, take it from \`verses.jsonl\` and the
  \`text_*\` fields, which contain no Leeds-derived data.
- **Translations:** public-domain editions only are included; each carries its own
  \`*.LICENSE.md\`. Display-only, non-redistributable editions are excluded.

## Reproducibility

Nothing here is hand-edited. Every artifact is produced by the open pipeline at
<https://github.com/quranbench/quranbench> (\`packages/corpus-build\`). The manifest
records the exact inputs and parameters, so this corpus version can be rebuilt and
checked against these checksums.

## Citing

See \`CITATION.cff\`. Cite the specific version (v${version}) and, where relevant,
the upstream Tanzil and Leeds QAC projects named in \`sources.json\`.
`;
writeFileSync(join(outDir, 'README.md'), readme);

// ── 7. Checksum manifest over the whole deposit ───────────────────────────────
function walkDeposit(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkDeposit(p, acc);
    else acc.push(p);
  }
  return acc;
}
const checksumLines = walkDeposit(outDir)
  .filter((p) => !p.endsWith('CHECKSUMS.sha256'))
  .sort()
  .map((p) => `${sha256(p)}  ${relative(outDir, p)}`);
writeFileSync(
  join(outDir, 'CHECKSUMS.sha256'),
  checksumLines.join('\n') + '\n',
);

console.log(
  `Zenodo deposit package written to:\n  ${relative(repoRoot, outDir)}\n`,
);
console.log(`Files: ${checksumLines.length + 1}`);
console.log(
  'Next: follow docs/zenodo.md to deposit manually (no upload is done here).',
);
