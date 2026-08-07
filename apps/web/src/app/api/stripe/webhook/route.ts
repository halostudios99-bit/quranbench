import { handleStripeWebhook } from '@/server/donations';

// Stripe posts payment events here. The signature check inside
// handleStripeWebhook is the authentication; an unsigned or mis-signed body
// is rejected. 200 for handled, 400 otherwise so Stripe retries.
export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('missing signature', { status: 400 });
  const body = await req.text();
  const result = await handleStripeWebhook(body, signature);
  return result.ok
    ? new Response('ok')
    : new Response(result.reason ?? 'rejected', { status: 400 });
}
