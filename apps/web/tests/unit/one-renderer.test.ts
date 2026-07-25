import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Architecture rule: <Verse> and <Token> are each the single renderer for their
// unit. If verse or token markup is duplicated across surfaces, every future
// action must be added in every place and they drift. This test enforces the
// invariant structurally: each JSX tag may be rendered in exactly one file.

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function filesRendering(tag: string): string[] {
  // Match `<Tag ` / `<Tag>` / `<Tag/` — a JSX render site — but not `<TagOther`.
  const re = new RegExp(`<${tag}[\\s/>]`);
  return walk(SRC).filter((file) => re.test(readFileSync(file, 'utf8')));
}

describe('one renderer per unit', () => {
  it('<Verse> is rendered in exactly one file (ReaderVerse)', () => {
    const files = filesRendering('Verse');
    expect(files.map((f) => f.replace(SRC, ''))).toEqual(['/components/ReaderVerse.tsx']);
  });

  it('<Token> is rendered in exactly one file (Verse)', () => {
    const files = filesRendering('Token');
    expect(files.map((f) => f.replace(SRC, ''))).toEqual(['/components/Verse.tsx']);
  });
});
