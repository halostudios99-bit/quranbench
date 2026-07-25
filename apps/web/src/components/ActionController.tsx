'use client';

import { useEffect } from 'react';

import { getAction, type ActionContext, type UnitType } from '@/actions/registry';
import type { CopyVariant } from '@/actions/copy';

// One controller for every verse action on the page. It delegates clicks from
// the document down to the button that was pressed, reads the enclosing verse's
// data attributes plus its rendered Arabic tokens, and runs the matching registry
// handler. This is the whole client cost of the action surface — no per-verse
// island — so reading pages ship almost no JavaScript.

function contextFor(article: HTMLElement, variant?: CopyVariant): ActionContext {
  const tokens = Array.from(article.querySelectorAll<HTMLElement>('[data-token-id]')).map(
    (el) => el.textContent?.trim() ?? '',
  );
  const arabicUthmani = tokens.join(' ');
  const url = article.dataset.url ?? '';
  return {
    unitType: (article.dataset.unitType as UnitType) ?? 'verse',
    id: article.dataset.verseId ?? '',
    url,
    ...(variant ? { variant } : {}),
    copy: {
      arabicUthmani,
      arabicPlain: article.dataset.arabicPlain ?? arabicUthmani,
      reference: article.dataset.ref ?? '',
      edition: article.dataset.edition ?? '',
      corpusVersion: article.dataset.corpusVersion ?? '',
      url,
    },
  };
}

function closeMenus(except?: Element) {
  document.querySelectorAll<HTMLElement>('[data-qb-menu]').forEach((menu) => {
    if (menu === except) return;
    menu.hidden = true;
    const toggle = menu.parentElement?.querySelector('[data-qb-toggle]');
    toggle?.setAttribute('aria-expanded', 'false');
  });
}

function flashStatus(article: HTMLElement, message: string) {
  const status = article.querySelector<HTMLElement>('[data-qb-status]');
  if (!status) return;
  status.textContent = message;
  window.setTimeout(() => {
    if (status.textContent === message) status.textContent = '';
  }, 2000);
}

export function ActionController() {
  useEffect(() => {
    async function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const toggle = target.closest<HTMLElement>('[data-qb-toggle]');
      if (toggle) {
        const menu = toggle.parentElement?.querySelector<HTMLElement>('[data-qb-menu]');
        if (menu) {
          const open = menu.hidden;
          closeMenus(open ? menu : undefined);
          menu.hidden = !open;
          toggle.setAttribute('aria-expanded', String(open));
        }
        return;
      }

      const button = target.closest<HTMLElement>('[data-qb-action]');
      if (!button) {
        closeMenus();
        return;
      }
      const article = button.closest<HTMLElement>('[data-verse-id]');
      const action = getAction(button.dataset.qbAction ?? '');
      if (!article || !action) return;

      const variant = button.dataset.qbVariant as CopyVariant | undefined;
      const result = await action.handler(contextFor(article, variant));
      closeMenus();
      flashStatus(article, result.message ?? (result.ok ? 'Done' : 'Failed'));
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenus();
    }

    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return null;
}
