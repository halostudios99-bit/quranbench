import 'server-only';

import nodemailer, { type Transporter } from 'nodemailer';

// The mail seam. Sending email is a deployment decision, not a build one, so the
// application depends only on this interface. Two implementations exist behind it:
//
//   - consoleMailer: the default when no SMTP credentials are configured. It
//     writes the link to the server log so local development needs no mail server.
//   - smtpMailer: a real nodemailer SMTP transport, selected automatically when
//     SMTP credentials are present. It logs only envelope metadata (recipient,
//     subject, message id) — never the message body, which carries a token.
//
// A zero-cost development provider: nodemailer's Ethereal (https://ethereal.email)
// gives free throwaway SMTP credentials with a web inbox — set SMTP_URL to the
// account's smtp URL and mail is captured, not delivered. See docs/deployment.md.

export interface Mailer {
  sendVerificationEmail(to: string, verifyUrl: string): Promise<void>;
  sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>;
}

interface Message {
  subject: string;
  text: string;
  html: string;
}

export function verificationMessage(verifyUrl: string): Message {
  return {
    subject: 'Confirm your quranbench email',
    text: `Confirm your email to publish on quranbench.\n\n${verifyUrl}\n\nThis link expires in 24 hours. If you did not create an account, ignore this email.`,
    html: `<p>Confirm your email to publish on quranbench.</p><p><a href="${verifyUrl}">Confirm your email</a></p><p>This link expires in 24 hours. If you did not create an account, ignore this email.</p>`,
  };
}

export function passwordResetMessage(resetUrl: string): Message {
  return {
    subject: 'Reset your quranbench password',
    text: `A password reset was requested for your quranbench account.\n\n${resetUrl}\n\nThis link expires in one hour and can be used once. If you did not request this, ignore this email — your password is unchanged.`,
    html: `<p>A password reset was requested for your quranbench account.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in one hour and can be used once. If you did not request this, ignore this email — your password is unchanged.</p>`,
  };
}

export const consoleMailer: Mailer = {
  async sendVerificationEmail(to, verifyUrl) {
    logLink('Verification', to, verifyUrl);
  },
  async sendPasswordResetEmail(to, resetUrl) {
    logLink('Password reset', to, resetUrl);
  },
};

function logLink(kind: string, to: string, url: string): void {
  // Development affordance only: printing the token link is the point of the
  // console mailer. The real (SMTP) path never logs the body — see below.
  console.info(
    `\n[mailer:console] ${kind} email for ${to}\n[mailer:console] Open this link:\n[mailer:console]   ${url}\n`,
  );
}

export function smtpMailer(
  transport: Pick<Transporter, 'sendMail'>,
  from: string,
): Mailer {
  async function send(to: string, message: Message): Promise<void> {
    const info = await transport.sendMail({ from, to, ...message });
    // Log envelope metadata only. The subject and message id are safe; the body
    // and the token-bearing URL are deliberately never logged.
    console.info(
      `[mailer:smtp] sent "${message.subject}" to ${to} (id ${info.messageId})`,
    );
  }
  return {
    sendVerificationEmail: (to, url) => send(to, verificationMessage(url)),
    sendPasswordResetEmail: (to, url) => send(to, passwordResetMessage(url)),
  };
}

let cached: Mailer | null = null;

/**
 * The active Mailer. Uses SMTP when credentials are configured (SMTP_URL, or the
 * discrete SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS set), otherwise the console
 * implementation. Memoised so the transport is built once per process.
 */
export function getMailer(): Mailer {
  if (cached) return cached;
  cached = buildMailer();
  return cached;
}

function buildMailer(): Mailer {
  const mode = process.env.MAILER;
  const from = process.env.MAIL_FROM || 'quranbench <no-reply@quranbench.com>';

  if (mode === 'console') return consoleMailer;

  const url = process.env.SMTP_URL;
  const host = process.env.SMTP_HOST;
  if (mode === 'smtp' || url || host) {
    const transport = url
      ? nodemailer.createTransport(url as string)
      : nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          auth:
            process.env.SMTP_USER && process.env.SMTP_PASS
              ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
              : undefined,
        });
    return smtpMailer(transport, from);
  }

  return consoleMailer;
}

/** Reset the memoised mailer. For tests that vary the environment. */
export function _resetMailer(): void {
  cached = null;
}
