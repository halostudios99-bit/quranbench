import type { Block, Inline } from '@/lib/markdown';

// Renders the tiny-Markdown block model (lib/markdown) as semantic, accessible
// HTML. Editorial prose — carries the editorial provenance where a page frames it.

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === 'strong') return <strong key={i}>{n.value}</strong>;
        if (n.type === 'code')
          return (
            <code
              key={i}
              className="rounded bg-soft px-1 py-0.5 font-ui text-[0.9em] text-ink2"
            >
              {n.value}
            </code>
          );
        return <span key={i}>{n.value}</span>;
      })}
    </>
  );
}

export function Prose({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-4 text-[15px] leading-relaxed text-ink2">
      {blocks.map((block, i) => {
        if (block.type === 'heading') {
          const cls =
            block.level === 1
              ? 'text-[26px] font-semibold text-ink'
              : block.level === 2
                ? 'mt-4 text-[19px] font-semibold text-ink'
                : 'mt-2 text-[16px] font-semibold text-ink';
          if (block.level === 1)
            return (
              <h1 key={i} className={cls}>
                <Inlines nodes={block.inline} />
              </h1>
            );
          if (block.level === 2)
            return (
              <h2 key={i} className={cls}>
                <Inlines nodes={block.inline} />
              </h2>
            );
          return (
            <h3 key={i} className={cls}>
              <Inlines nodes={block.inline} />
            </h3>
          );
        }
        if (block.type === 'list')
          return (
            <ul key={i} className="ms-5 flex list-disc flex-col gap-2">
              {block.items.map((item, j) => (
                <li key={j}>
                  <Inlines nodes={item} />
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            <Inlines nodes={block.inline} />
          </p>
        );
      })}
    </div>
  );
}
