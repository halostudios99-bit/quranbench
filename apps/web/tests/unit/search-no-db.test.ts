import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// Module boundary (CLAUDE.md): `packages/search` must be testable with no
// database and no app. This is the static guarantee — no source file in the
// search package may import Prisma, the app database, or the application layer.
// If this fails, the boundary that keeps search a pure, in-memory engine is
// broken.

const SEARCH_SRC = resolve(process.cwd(), '..', '..', 'packages', 'search', 'src');

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

const FORBIDDEN = [
  /@prisma\/client/,
  /\bprisma\b/i,
  /@quranbench\/web/,
  /['"]pg['"]/,
  /server-only/,
  /@\/server/,
];

const IMPORT_RE = /^\s*(?:import|export)\b[^\n]*from\s*['"][^'"]+['"]/gm;
const REQUIRE_RE = /require\(\s*['"][^'"]+['"]\s*\)/g;

describe('packages/search has no database dependency', () => {
  const files = tsFiles(SEARCH_SRC);

  it('finds search source to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = file.slice(SEARCH_SRC.length + 1);
    it(`does not import a database or the app: ${rel}`, () => {
      const source = readFileSync(file, 'utf8');
      const importLines = [
        ...(source.match(IMPORT_RE) ?? []),
        ...(source.match(REQUIRE_RE) ?? []),
      ];
      for (const line of importLines)
        for (const pattern of FORBIDDEN)
          expect(
            pattern.test(line),
            `${rel} imports a forbidden module: ${line.trim()}`,
          ).toBe(false);
    });
  }
});
