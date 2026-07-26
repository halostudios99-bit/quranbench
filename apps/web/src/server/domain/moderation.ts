import { checkRateLimit } from './rate-limit';
import type { CreateReportInput, Store } from './store';

export type ReportResult =
  | { ok: true; id: string }
  | { ok: false; code: 'reason' | 'rate_limited'; message: string };

export type CorrectionResult =
  | { ok: true; id: string }
  | { ok: false; code: 'path' | 'problem' | 'rate_limited'; message: string };

export interface CorrectionInput {
  /** The path of the page being corrected, e.g. `/2/43` or `/word/…`. */
  path: string;
  /** What is wrong. Required — a report with no substance is not actionable. */
  problem: string;
  /** What it should be instead. Optional. */
  correction?: string | null;
  /** How to reach the reporter, if they choose to leave it. Optional. */
  contact?: string | null;
  reporterId: string | null;
  clientId: string;
}

/**
 * Report a correction against a public page. It writes to the same moderation
 * queue as content reports, as a PAGE-targeted row whose targetId is the page
 * path. Works without an account (rate limited on the client id) and, because it
 * is a plain server action, without JavaScript. Corrections to Quranic text are
 * impossible by design — the source text is immutable — so a correction only ever
 * concerns annotations, translations or editorial content; the UI says so.
 */
export async function submitCorrection(
  store: Store,
  input: CorrectionInput,
  now: Date = new Date(),
): Promise<CorrectionResult> {
  const path = input.path.trim();
  if (!path.startsWith('/'))
    return { ok: false, code: 'path', message: 'The page being corrected is missing.' };
  const problem = input.problem.trim();
  if (problem.length === 0)
    return { ok: false, code: 'problem', message: 'Describe what is wrong so it can be checked.' };

  const subject = input.reporterId ?? input.clientId;
  const limit = await checkRateLimit(store, 'REPORT', subject, now);
  if (!limit.ok)
    return { ok: false, code: 'rate_limited', message: 'Too many reports. Try again later.' };

  const detailParts: string[] = [];
  const correction = input.correction?.trim();
  if (correction) detailParts.push(`Should be: ${correction}`);
  const contact = input.contact?.trim();
  if (contact) detailParts.push(`Contact: ${contact}`);

  const { id } = await store.createReport({
    reporterId: input.reporterId,
    targetType: 'PAGE',
    targetId: path,
    reason: problem,
    detail: detailParts.length > 0 ? detailParts.join('\n') : null,
  });
  return { ok: true, id };
}

/**
 * The report action. It writes to the moderation queue and nothing else — there
 * is no moderation UI in this prompt, only the durable, auditable record. Every
 * moderation action is a row (docs/extensibility.md §7). Rate limited per
 * reporter to blunt report-spam.
 */
export async function reportContent(
  store: Store,
  input: CreateReportInput & { clientId: string },
  now: Date = new Date(),
): Promise<ReportResult> {
  if (input.reason.trim().length === 0)
    return { ok: false, code: 'reason', message: 'A reason is required to report content.' };

  const subject = input.reporterId ?? input.clientId;
  const limit = await checkRateLimit(store, 'REPORT', subject, now);
  if (!limit.ok)
    return { ok: false, code: 'rate_limited', message: 'Too many reports. Try again later.' };

  const { id } = await store.createReport({
    reporterId: input.reporterId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason.trim(),
    detail: input.detail ?? null,
  });
  return { ok: true, id };
}
