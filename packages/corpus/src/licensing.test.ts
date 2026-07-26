import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// The repository is MIT-licensed and meant to be forked and used commercially.
// A non-redistributable edition (Talal Itani's ClearQuran, CC BY-NC-ND 4.0) is
// fetched at build time but must NEVER be committed — shipping it inside the repo
// would create licensing ambiguity for anyone who forks. This test is the guard:
// it reads every manifest, finds the editions marked redistributable:false, and
// asserts neither their data artifact nor their licence file is tracked by git.

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const outDir = join(repoRoot, 'packages', 'corpus-build', 'out');

function trackedFiles(): Set<string> {
  const out = execFileSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return new Set(out.split('\n').filter(Boolean));
}

function nonRedistributableArtifacts(): string[] {
  const paths: string[] = [];
  const versions = readdirSync(outDir).filter((n) => /^v\d+\.\d+\.\d+$/.test(n));
  for (const v of versions) {
    const manifestPath = join(outDir, v, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      translations?: {
        editions?: {
          redistributable: boolean;
          artifact: string;
          licence_file?: string;
        }[];
      };
    };
    for (const e of manifest.translations?.editions ?? []) {
      if (e.redistributable === false) {
        paths.push(`packages/corpus-build/out/${v}/${e.artifact}`);
        if (e.licence_file) {
          paths.push(`packages/corpus-build/out/${v}/${e.licence_file}`);
        }
      }
    }
  }
  return paths;
}

describe('non-redistributable artifacts', () => {
  it('at least one display-only edition is declared (guards the test itself)', () => {
    expect(nonRedistributableArtifacts().length).toBeGreaterThan(0);
  });

  it('no non-redistributable artifact is tracked by git', () => {
    const tracked = trackedFiles();
    const leaked = nonRedistributableArtifacts().filter((p) => tracked.has(p));
    expect(leaked).toEqual([]);
  });
});
