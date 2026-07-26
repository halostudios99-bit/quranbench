import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  _resetMailer,
  consoleMailer,
  getMailer,
  passwordResetMessage,
  smtpMailer,
  verificationMessage,
} from '@/server/mailer';

const TOKEN_URL = 'https://quranbench.com/verify/SECRET-TOKEN-abc123';

afterEach(() => {
  _resetMailer();
  delete process.env.MAILER;
  delete process.env.SMTP_URL;
  delete process.env.SMTP_HOST;
  vi.restoreAllMocks();
});

describe('mailer selection', () => {
  it('defaults to the console mailer with no SMTP configuration', () => {
    expect(getMailer()).toBe(consoleMailer);
  });

  it('selects an SMTP mailer when SMTP_HOST is set', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    _resetMailer();
    expect(getMailer()).not.toBe(consoleMailer);
  });

  it('honours MAILER=console even when SMTP is configured', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.MAILER = 'console';
    _resetMailer();
    expect(getMailer()).toBe(consoleMailer);
  });
});

describe('smtp mailer never logs the token', () => {
  it('logs only envelope metadata, not the message body or URL', async () => {
    const sent: Array<{ to?: string; text?: string; html?: string }> = [];
    const transport = {
      async sendMail(opts: { to?: string; text?: string; html?: string }) {
        sent.push(opts);
        return { messageId: '<abc@id>' };
      },
    };
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const mailer = smtpMailer(transport, 'no-reply@quranbench.com');

    await mailer.sendVerificationEmail('user@example.com', TOKEN_URL);

    // The message actually carried the token URL...
    expect(sent[0]!.text).toContain(TOKEN_URL);
    // ...but no log line did.
    const logged = info.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(logged).not.toContain('SECRET-TOKEN');
    expect(logged).not.toContain(TOKEN_URL);
    expect(logged).toContain('user@example.com');
    expect(logged).toContain('<abc@id>');
  });
});

describe('message templates carry the link and an expiry note', () => {
  it('verification', () => {
    const m = verificationMessage(TOKEN_URL);
    expect(m.text).toContain(TOKEN_URL);
    expect(m.html).toContain(TOKEN_URL);
    expect(m.text).toContain('24 hours');
  });
  it('password reset', () => {
    const m = passwordResetMessage(TOKEN_URL);
    expect(m.text).toContain(TOKEN_URL);
    expect(m.text).toContain('once');
  });
});
