'use client';

import { ThemeProvider as NextThemeProvider } from 'next-themes';

// next-themes sets `data-theme` before first paint via an inline script, so the
// theme never flashes on load. CSS custom properties do the rest.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
      {children}
    </NextThemeProvider>
  );
}
