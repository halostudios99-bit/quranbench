import 'server-only';

// The mail seam. Sending email is a deployment decision, not a build one, so the
// application depends only on this interface. In development the console
// implementation writes the verification link to the server log; a real provider
// (Postmark, SES, …) drops in behind the same interface without touching any
// caller. Selection is by env so production can bind a real Mailer later.

export interface Mailer {
  sendVerificationEmail(to: string, verifyUrl: string): Promise<void>;
}

export const consoleMailer: Mailer = {
  async sendVerificationEmail(to, verifyUrl) {
    console.info(
      `\n[mailer:console] Verification email for ${to}\n[mailer:console] Open this link to verify:\n[mailer:console]   ${verifyUrl}\n`,
    );
  },
};

/**
 * The active Mailer. Only the console implementation exists today; when a real
 * provider is added it is selected here by env (e.g. MAILER=postmark), so no
 * caller changes.
 */
export function getMailer(): Mailer {
  return consoleMailer;
}
