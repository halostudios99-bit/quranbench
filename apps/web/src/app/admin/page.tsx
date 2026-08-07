import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import { getCurrentUser, hasRole } from '@/server/auth';
import { prisma } from '@/server/db';

export const metadata: Metadata = {
  title: 'Admin — QuranBench',
  robots: { index: false },
};

export const dynamic = 'force-dynamic';

// The moderation queue existed as a table for months with no way to work it:
// reports arrived and nobody privileged could act. This page is deliberately
// small — the open reports, resolve/dismiss, and the two grants (role, badge)
// an admin needs. It 404s rather than 403s for non-admins: advertising an
// admin page's existence to the public buys nothing.

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!hasRole(user, 'ADMIN')) notFound();
  return user!;
}

async function setReportStatus(formData: FormData) {
  'use server';
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const status = String(formData.get('status') ?? '');
  if (!id || !['RESOLVED', 'DISMISSED', 'REVIEWING'].includes(status)) return;
  await prisma.moderationReport.update({
    where: { id },
    data: { status: status as 'RESOLVED' | 'DISMISSED' | 'REVIEWING' },
  });
  revalidatePath('/admin');
}

async function grant(formData: FormData) {
  'use server';
  await requireAdmin();
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const what = String(formData.get('what') ?? '');
  if (!email) return;
  if (what === 'MODERATOR' || what === 'ADMIN' || what === 'USER') {
    await prisma.user.updateMany({ where: { email }, data: { role: what } });
  } else if (what === 'BADGE') {
    // For off-platform gifts (bank transfer etc.): record it, then badge.
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.donation.create({
        data: {
          userId: user.id,
          email,
          amountCents: 0,
          provider: 'manual',
          providerRef: `manual-${user.id}-${Date.now()}`,
          status: 'SUCCEEDED',
        },
      });
      await prisma.user.updateMany({
        where: { id: user.id, supporterSince: null },
        data: { supporterSince: new Date() },
      });
    }
  }
  revalidatePath('/admin');
}

export default async function AdminPage() {
  await requireAdmin();

  const [reports, donations] = await Promise.all([
    prisma.moderationReport.findMany({
      where: { status: { in: ['OPEN', 'REVIEWING'] } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
    prisma.donation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { handle: true, email: true } } },
    }),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-[28px] font-semibold text-ink">Admin</h1>

      <h2 className="mt-8 text-[17px] font-semibold text-ink">
        Moderation queue ({reports.length} open)
      </h2>
      {reports.length === 0 ? (
        <p className="mt-2 text-[14px] text-ink3">Nothing waiting.</p>
      ) : (
        <ol className="mt-3 flex flex-col divide-y divide-line">
          {reports.map((r) => (
            <li key={r.id} className="py-4">
              <p className="text-[14px] text-ink">
                <span className="font-semibold">{r.targetType}</span>{' '}
                <span className="text-ink3">{r.targetId}</span>
              </p>
              <p className="mt-1 text-[15px] text-ink2">{r.reason}</p>
              {r.detail ? (
                <p className="mt-1 whitespace-pre-wrap text-[14px] text-ink3">
                  {r.detail}
                </p>
              ) : null}
              <div className="mt-2 flex gap-2">
                {(['RESOLVED', 'DISMISSED'] as const).map((s) => (
                  <form key={s} action={setReportStatus}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="status" value={s} />
                    <button className="rounded border border-line px-3 py-1.5 text-[13px] text-ink2 hover:border-line2">
                      {s === 'RESOLVED' ? 'Resolve' : 'Dismiss'}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}

      <h2 className="mt-10 text-[17px] font-semibold text-ink">Grant</h2>
      <form action={grant} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="email"
          name="email"
          required
          placeholder="user email"
          className="rounded border border-line bg-bg px-3 py-2 text-[14px]"
        />
        <select
          name="what"
          className="rounded border border-line bg-bg px-3 py-2 text-[14px]"
        >
          <option value="BADGE">supporter badge</option>
          <option value="MODERATOR">moderator role</option>
          <option value="ADMIN">admin role</option>
          <option value="USER">plain user (revoke roles)</option>
        </select>
        <button className="rounded bg-accent px-4 py-2 text-[14px] font-semibold text-white">
          Apply
        </button>
      </form>

      <h2 className="mt-10 text-[17px] font-semibold text-ink">
        Recent donations
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-line text-[14px]">
        {donations.map((d) => (
          <li key={d.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span className="text-ink2">
              {d.user?.handle ?? d.email ?? 'anonymous'} · {d.provider}
            </span>
            <span className="text-ink3">
              £{(d.amountCents / 100).toFixed(2)} · {d.status}
            </span>
          </li>
        ))}
        {donations.length === 0 ? (
          <li className="py-2 text-ink3">None yet.</li>
        ) : null}
      </ul>
    </main>
  );
}
