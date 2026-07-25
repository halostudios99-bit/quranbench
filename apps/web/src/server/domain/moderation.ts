import { checkRateLimit } from './rate-limit';
import type { CreateReportInput, Store } from './store';

export type ReportResult =
  | { ok: true; id: string }
  | { ok: false; code: 'reason' | 'rate_limited'; message: string };

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
