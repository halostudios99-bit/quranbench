import { writeClipboard } from './clipboard';
import { buildCopyPayload, type CopySource, type CopyVariant } from './copy';

// The action surface as data (architecture doc §"Action registry"). New actions
// — bookmark, report, pin as evidence, compare translations, listen — are added
// here as an entry plus a handler; no renderer changes. Renderers ask the
// registry which actions apply to a unit type and render them uniformly.

export type UnitType = 'surah' | 'verse' | 'range' | 'token' | 'root';

/** Everything a handler needs, resolved on the server and passed to the client. */
export interface ActionContext {
  unitType: UnitType;
  /** Stable identifier, e.g. `quran:2:43`. */
  id: string;
  /** Canonical absolute URL — the share/permalink target, never UI state. */
  url: string;
  /** Data for building copy/cite payloads. */
  copy: CopySource;
  /** Optional copy variant selected in the UI; defaults to `arabic-ref`. */
  variant?: CopyVariant;
}

export interface ActionResult {
  ok: boolean;
  /** Short status for optimistic UI, e.g. "Copied" or "Link copied". */
  message?: string;
}

export interface ActionDef {
  id: string;
  unitTypes: UnitType[];
  label: string;
  /** Icon key resolved by the renderer to an inline SVG. */
  icon: string;
  requiresAuth: boolean;
  /** Surfaces this action appears in. */
  showIn: ('toolbar' | 'menu')[];
  handler: (ctx: ActionContext) => Promise<ActionResult> | ActionResult;
}

export const ACTIONS: ActionDef[] = [
  {
    id: 'copy',
    unitTypes: ['verse', 'range', 'token', 'surah'],
    label: 'Copy',
    icon: 'copy',
    requiresAuth: false,
    showIn: ['toolbar', 'menu'],
    handler: async (ctx) => {
      const payload = buildCopyPayload(ctx.variant ?? 'arabic-ref', ctx.copy);
      const ok = await writeClipboard(payload);
      return { ok, message: ok ? 'Copied' : 'Copy failed' };
    },
  },
  {
    id: 'permalink',
    unitTypes: ['verse', 'range', 'token', 'surah', 'root'],
    label: 'Permalink',
    icon: 'link',
    requiresAuth: false,
    showIn: ['toolbar', 'menu'],
    handler: async (ctx) => {
      const ok = await writeClipboard({ text: ctx.url, html: `<a href="${ctx.url}">${ctx.url}</a>` });
      return { ok, message: ok ? 'Link copied' : 'Copy failed' };
    },
  },
  {
    id: 'share',
    unitTypes: ['verse', 'range', 'token', 'surah', 'root'],
    label: 'Share',
    icon: 'share',
    requiresAuth: false,
    showIn: ['toolbar', 'menu'],
    handler: async (ctx) => {
      // Web Share on mobile; fall back to copying the canonical link.
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: ctx.copy.reference, text: ctx.copy.reference, url: ctx.url });
          return { ok: true, message: 'Shared' };
        } catch {
          // User dismissed, or share failed — fall through to copy.
        }
      }
      const ok = await writeClipboard({ text: ctx.url, html: `<a href="${ctx.url}">${ctx.url}</a>` });
      return { ok, message: ok ? 'Link copied' : 'Share unavailable' };
    },
  },
  {
    id: 'cite',
    unitTypes: ['verse', 'range', 'token', 'surah'],
    label: 'Cite',
    icon: 'quote',
    requiresAuth: false,
    showIn: ['toolbar', 'menu'],
    handler: async (ctx) => {
      const payload = buildCopyPayload('citation', ctx.copy);
      const ok = await writeClipboard(payload);
      return { ok, message: ok ? 'Citation copied' : 'Copy failed' };
    },
  },
];

export function actionsFor(unitType: UnitType, showIn: 'toolbar' | 'menu' = 'toolbar'): ActionDef[] {
  return ACTIONS.filter((a) => a.unitTypes.includes(unitType) && a.showIn.includes(showIn));
}

export function getAction(id: string): ActionDef | undefined {
  return ACTIONS.find((a) => a.id === id);
}
