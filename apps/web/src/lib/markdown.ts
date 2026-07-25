// A deliberately tiny Markdown-to-blocks parser. It exists so that a small number
// of prose documents (the contributor terms, the moderation policy) can be
// authored once in docs/*.md and rendered as accessible HTML without pulling in a
// full Markdown dependency. It supports exactly what those documents use:
// headings, bold, inline code, unordered lists and paragraphs. It is not a
// general Markdown engine and never renders raw HTML.

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'strong'; value: string }
  | { type: 'code'; value: string };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; inline: Inline[] }
  | { type: 'paragraph'; inline: Inline[] }
  | { type: 'list'; items: Inline[][] };

const INLINE_RE = /(\*\*[^*]+\*\*|`[^`]+`)/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE_RE)) {
    const idx = match.index ?? 0;
    if (idx > last) out.push({ type: 'text', value: text.slice(last, idx) });
    const token = match[0];
    if (token.startsWith('**'))
      out.push({ type: 'strong', value: token.slice(2, -2) });
    else out.push({ type: 'code', value: token.slice(1, -1) });
    last = idx + token.length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: 'list', items: list.map(parseInline) });
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const item = /^-\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: 'heading',
        level: heading[1]!.length as 1 | 2 | 3,
        inline: parseInline(heading[2]!),
      });
    } else if (item) {
      flushParagraph();
      list.push(item[1]!);
    } else if (line.trim() === '') {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraph.push(line.trim());
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}
