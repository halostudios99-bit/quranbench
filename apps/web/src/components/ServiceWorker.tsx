'use client';

import { useEffect } from 'react';

// Registers the service worker after load so the app shell and visited pages are
// cached for offline reading. Registration is progressive: with no SW support,
// or if it fails, the site works exactly as before.
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline support is an enhancement; ignore failures */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
