'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';

import { Icon } from './Icon';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={mounted ? `Switch to ${isDark ? 'light' : 'dark'} mode` : 'Toggle theme'}
      className="flex h-10 w-10 items-center justify-center rounded-md text-ink2 hover:bg-soft hover:text-ink"
    >
      {mounted ? <Icon name={isDark ? 'sun' : 'moon'} size={18} /> : <Icon name="moon" size={18} />}
    </button>
  );
}
