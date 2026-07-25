import { describe, expect, it } from 'vitest';

import { parseInline, parseMarkdown } from '@/lib/markdown';

describe('parseInline', () => {
  it('splits bold, code and plain text', () => {
    expect(parseInline('a **bold** and `code` end')).toEqual([
      { type: 'text', value: 'a ' },
      { type: 'strong', value: 'bold' },
      { type: 'text', value: ' and ' },
      { type: 'code', value: 'code' },
      { type: 'text', value: ' end' },
    ]);
  });
});

describe('parseMarkdown', () => {
  it('parses headings, paragraphs and lists', () => {
    const blocks = parseMarkdown(
      ['# Title', '', 'A paragraph.', '', '- one', '- two'].join('\n'),
    );
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 });
    expect(blocks[1]).toMatchObject({ type: 'paragraph' });
    expect(blocks[2]).toMatchObject({ type: 'list' });
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
  });

  it('renders the contributor terms without throwing', async () => {
    const { readFile } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    const path = resolve(
      process.cwd(),
      '..',
      '..',
      'docs',
      'contributor-terms.md',
    );
    const blocks = parseMarkdown(await readFile(path, 'utf8'));
    expect(blocks.length).toBeGreaterThan(5);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 });
  });
});
