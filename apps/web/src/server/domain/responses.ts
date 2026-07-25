import { assertCanContribute } from './accounts';
import type { CorpusGateway } from './corpus-gateway';
import { checkRateLimit } from './rate-limit';
import type { CreateResponseInput, Store } from './store';
import { RESPONSE_TYPES, type Response } from './types';

export type ResponseResult =
  | { ok: true; response: Response }
  | { ok: false; code: 'type' | 'evidence' | 'body' | 'rate_limited' | 'not_found'; message: string };

/**
 * Create a response to an investigation. A response is structured, not a free
 * comment: it must declare a valid type and must cite at least one piece of
 * evidence (docs/extensibility.md §7). Both are enforced here in the data layer.
 */
export async function createResponse(
  store: Store,
  gateway: CorpusGateway,
  input: CreateResponseInput,
  now: Date = new Date(),
): Promise<ResponseResult> {
  await assertCanContribute(store, input.authorId);

  if (!RESPONSE_TYPES.includes(input.type))
    return {
      ok: false,
      code: 'type',
      message: 'A response must declare a type: disputes, supports, clarifies or adds evidence.',
    };
  if (input.pins.length === 0)
    return {
      ok: false,
      code: 'evidence',
      message: 'A response must cite evidence — attach at least one evidence pin.',
    };
  if (input.body.trim().length === 0)
    return { ok: false, code: 'body', message: 'A response cannot be empty.' };

  if (!(await store.getInvestigation(input.investigationId)))
    return { ok: false, code: 'not_found', message: 'Investigation not found.' };

  const limit = await checkRateLimit(store, 'RESPONSE', input.authorId, now);
  if (!limit.ok)
    return {
      ok: false,
      code: 'rate_limited',
      message: 'Response rate limit reached. Try again later.',
    };

  const response = await store.createResponse(input, gateway.version);
  return { ok: true, response };
}
