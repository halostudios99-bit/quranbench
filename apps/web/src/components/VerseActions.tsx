import { COPY_VARIANTS } from '@/actions/copy';
import { actionsFor, type UnitType } from '@/actions/registry';
import { Icon } from './Icon';

// Server-rendered action toolbar. There is no client island per verse — a single
// delegated controller (ActionController, mounted once) handles every button on
// the page. That keeps reading pages near-zero JavaScript even when a surah has
// hundreds of verses, and the buttons are driven by the action registry so a new
// action appears here without a code change.

const ICONS: Record<string, 'copy' | 'link' | 'share' | 'quote'> = {
  copy: 'copy',
  permalink: 'link',
  share: 'share',
  cite: 'quote',
};

export function VerseActions({ unitType }: { unitType: UnitType }) {
  const actions = actionsFor(unitType, 'toolbar');
  return (
    <div className="qb-actions relative flex items-center gap-1" data-qb-actions>
      {actions.map((action) =>
        action.id === 'copy' ? (
          <div key="copy" className="relative">
            <button
              type="button"
              data-qb-toggle="copy-menu"
              aria-haspopup="menu"
              aria-expanded="false"
              className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink2 hover:bg-soft hover:text-ink"
            >
              <Icon name="copy" />
              <span>Copy</span>
            </button>
            <div
              role="menu"
              data-qb-menu="copy-menu"
              hidden
              className="absolute end-0 z-20 mt-1 min-w-56 overflow-hidden rounded-lg border border-line bg-panel py-1 shadow-lg"
            >
              {COPY_VARIANTS.map((v) => (
                <button
                  key={v.variant}
                  type="button"
                  role="menuitem"
                  data-qb-action="copy"
                  data-qb-variant={v.variant}
                  className="block w-full px-3 py-2 text-start text-[13px] text-ink2 hover:bg-soft hover:text-ink"
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            key={action.id}
            type="button"
            data-qb-action={action.id}
            aria-label={action.label}
            className="flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink2 hover:bg-soft hover:text-ink"
          >
            <Icon name={ICONS[action.id] ?? 'link'} />
            <span className="sr-only sm:not-sr-only">{action.label}</span>
          </button>
        ),
      )}
      <span data-qb-status aria-live="polite" role="status" className="ms-1 text-[12px] text-accent" />
    </div>
  );
}
