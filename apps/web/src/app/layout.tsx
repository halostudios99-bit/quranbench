import type { Metadata, Viewport } from 'next';

import { ActionController } from '@/components/ActionController';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { ThemeProvider } from '@/components/ThemeProvider';
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site';
import '@/styles/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE}`,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    'An open Quran research workbench. Every word, root and occurrence is a permanent, addressable research object — with the method shown for every result so you can reproduce it yourself.',
  applicationName: SITE_NAME,
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    url: SITE_URL,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf9f6' },
    { media: '(prefers-color-scheme: dark)', color: '#16150f' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-panel focus:px-3 focus:py-2 focus:text-ink"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="mx-auto max-w-wrap px-5 pb-8 pt-8 sm:px-8">
            {children}
          </main>
          <SiteFooter />
          <ActionController />
        </ThemeProvider>
      </body>
    </html>
  );
}
