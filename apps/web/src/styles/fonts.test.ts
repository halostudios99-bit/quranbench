import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const css = readFileSync(
  fileURLToPath(new URL('./globals.css', import.meta.url)),
  'utf8',
);
const fontsDir = fileURLToPath(new URL('../../public/fonts/', import.meta.url));

function fontFaceUrls(source: string): string[] {
  const urls: string[] = [];
  const blockRe = /@font-face\s*{([^}]*)}/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(source))) {
    const urlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = urlRe.exec(block[1]!))) urls.push(m[1]!);
  }
  return urls;
}

describe('fonts are self-hosted', () => {
  it('globals.css makes no external font request', () => {
    expect(css).not.toContain('fonts.googleapis.com');
    expect(css).not.toContain('fonts.gstatic.com');
    // No absolute/remote URL inside any @font-face src.
    for (const url of fontFaceUrls(css)) {
      expect(url, url).not.toMatch(/^https?:\/\//);
      expect(url, url).not.toMatch(/^\/\//);
    }
  });

  it('every @font-face src points at a local /fonts/*.woff2 path', () => {
    const urls = fontFaceUrls(css);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url, url).toMatch(/^\/fonts\/[\w-]+\.woff2$/);
    }
  });

  it('every referenced woff2 file exists on disk', () => {
    for (const url of fontFaceUrls(css)) {
      const file = fontsDir + url.replace(/^\/fonts\//, '');
      expect(existsSync(file), file).toBe(true);
    }
  });

  it('does not reference the dropped KFGQPC font', () => {
    expect(css).not.toContain('KFGQPC');
    expect(css).not.toContain('uthmanic-hafs');
  });
});
