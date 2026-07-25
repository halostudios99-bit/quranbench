import type { CopyPayload } from './copy';

/**
 * Write both clipboard flavours so a rich editor keeps RTL and the reference
 * line, and a plain editor still gets attributed text. Falls back to plain text
 * where the async Clipboard API or ClipboardItem is unavailable.
 */
export async function writeClipboard(payload: Pick<CopyPayload, 'text' | 'html'>): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      'write' in navigator.clipboard &&
      typeof ClipboardItem !== 'undefined'
    ) {
      const item = new ClipboardItem({
        'text/plain': new Blob([payload.text], { type: 'text/plain' }),
        'text/html': new Blob([payload.html], { type: 'text/html' }),
      });
      await navigator.clipboard.write([item]);
      return true;
    }
    await navigator.clipboard.writeText(payload.text);
    return true;
  } catch {
    return false;
  }
}
