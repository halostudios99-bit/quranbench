import 'server-only';

import Stripe from 'stripe';

import { prisma } from './db';

// Donations are personal gifts to the maintainer — the site says so in those
// words. They buy nothing: content is never gated (CLAUDE.md rule 5), and the
// supporter badge is a thank-you, not an entitlement. This module owns the
// whole flow: create a Stripe Checkout session, record the pending donation,
// and on the webhook mark it succeeded and set the donor's badge.
//
// Stripe is OPTIONAL by construction. Until STRIPE_SECRET_KEY exists the
// donate page renders with payments disabled and says so honestly — the same
// pattern as the mailer. Nothing else on the site imports payment state.

const CURRENCY = 'gbp';

/** Preset one-off amounts, in pence. The page also allows a custom amount. */
export const PRESET_AMOUNTS = [500, 1500, 5000] as const;

export const MIN_AMOUNT = 200; // Stripe's practical minimum region, ~£2
export const MAX_AMOUNT = 500_000; // £5,000 — above this, talk to a human

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key);
}

/**
 * Create a Checkout session for a one-off gift and record it as PENDING.
 * Returns the URL to redirect the donor to.
 */
export async function createDonationCheckout(options: {
  amountCents: number;
  userId?: string | undefined;
  siteUrl: string;
}): Promise<string> {
  const amount = Math.floor(options.amountCents);
  if (!Number.isFinite(amount) || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    throw new Error('invalid amount');
  }

  const session = await stripeClient().checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: amount,
          product_data: {
            name: 'Gift to the QuranBench maintainer',
            description:
              'A personal gift supporting the running of quranbench.com. Not a charitable donation.',
          },
        },
      },
    ],
    success_url: `${options.siteUrl}/donate/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${options.siteUrl}/donate`,
    ...(options.userId ? { metadata: { userId: options.userId } } : {}),
  });

  if (!session.url) throw new Error('Stripe returned no checkout URL');

  await prisma.donation.create({
    data: {
      userId: options.userId ?? null,
      amountCents: amount,
      currency: CURRENCY,
      provider: 'stripe',
      providerRef: session.id,
      status: 'PENDING',
    },
  });

  return session.url;
}

/**
 * Handle Stripe's webhook. Verifies the signature, marks the donation
 * SUCCEEDED, and sets the donor's badge. Idempotent: the providerRef is
 * unique and the update is a no-op the second time.
 */
export async function handleStripeWebhook(
  rawBody: string,
  signature: string,
): Promise<{ ok: boolean; reason?: string }> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, reason: 'webhook secret not configured' };

  let event: Stripe.Event;
  try {
    event = await stripeClient().webhooks.constructEventAsync(
      rawBody,
      signature,
      secret,
    );
  } catch {
    return { ok: false, reason: 'bad signature' };
  }

  if (event.type !== 'checkout.session.completed') return { ok: true };

  const session = event.data.object as Stripe.Checkout.Session;
  const donation = await prisma.donation.update({
    where: { providerRef: session.id },
    data: {
      status: 'SUCCEEDED',
      email: session.customer_details?.email ?? null,
    },
  });

  if (donation.userId) {
    // Only set, never clear, and never move an earlier date forward.
    await prisma.user.updateMany({
      where: { id: donation.userId, supporterSince: null },
      data: { supporterSince: new Date() },
    });
  }

  return { ok: true };
}

/** A successfully paid session, for the thanks page. */
export async function donationBySession(sessionId: string) {
  return prisma.donation.findUnique({ where: { providerRef: sessionId } });
}
