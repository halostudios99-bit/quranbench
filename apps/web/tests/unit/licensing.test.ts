import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

// The open-data promise is ungranted without an actual licence. These tests are
// the guard: a root LICENSE must exist, and every package.json must declare a
// license field, so the software is never silently all-rights-reserved.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

const SKIP = new Set(['node_modules', '.next', 'dist', '.git', 'out']);

function findPackageJsons(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) findPackageJsons(full, acc);
    else if (entry === 'package.json') acc.push(full);
  }
  return acc;
}

describe('licensing', () => {
  it('a root LICENSE file exists', () => {
    expect(existsSync(join(repoRoot, 'LICENSE'))).toBe(true);
  });

  it('every package.json declares a license', () => {
    const manifests = findPackageJsons(repoRoot);
    expect(manifests.length).toBeGreaterThan(0);
    for (const file of manifests) {
      const pkg = JSON.parse(readFileSync(file, 'utf8')) as { license?: string };
      expect(
        typeof pkg.license === 'string' && pkg.license.length > 0,
        `${relative(repoRoot, file)} must declare a "license"`,
      ).toBe(true);
    }
  });
});
